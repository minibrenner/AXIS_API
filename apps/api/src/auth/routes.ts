// apps/api/src/auth/routes.ts
import { Router } from "express";
import argon2 from "argon2";
import { basePrisma, prisma } from "../prisma/client";
import {
  validateUser,
  issueTokens,
  revokeAllUserSessions,
  createPasswordResetTokenForUser,
  resetUserPasswordFromToken,
} from "./auth.service";
import { verifyRefresh } from "./jwt";
import { jwtAuth } from "./middleware";
import { ErrorCodes, respondWithError } from "../utils/httpErrors";
import { TenantContext } from "../tenancy/tenant.context";
import { validateBody } from "../middlewares/validateBody";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./validators/auth.schemas";
import { sendPasswordResetEmail } from "../utils/mailer";
import { env } from "../config/env";

export const authRouter = Router();

/**
 * POST /auth/login
 * Body: { email, password }
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  const missing: string[] = [];
  if (!email) missing.push("email");
  if (!password) missing.push("password");

  if (missing.length) {
    return respondWithError(res, {
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: "Campos email e password sao obrigatorios.",
      details: { missing },
    });
  }

  const user = await validateUser(email!, password!);
  if (!user) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.INVALID_CREDENTIALS,
      message: "Credenciais invalidas.",
    });
  }

  const tokens = await TenantContext.run(user.tenantId, () =>
    issueTokens(
      { id: user.id, tenantId: user.tenantId, role: user.role },
      req.get("user-agent") ?? "",
      req.ip
    )
  );
  return res.json(tokens);
});

/**
 * GET /auth/me
 * Header: Authorization: Bearer <access>
 * Retorna dados basicos do portador do token,
 * enriquecidos com nome/email do usuario.
 */
authRouter.get("/me", jwtAuth(false), async (req, res) => {
  if (!req.user) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.UNAUTHENTICATED,
      message: "Nao autenticado.",
    });
  }

  const { userId } = req.user;

  try {
    const user = await basePrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true, name: true, email: true },
    });

    if (!user) {
      return respondWithError(res, {
        status: 404,
        code: ErrorCodes.USER_NOT_FOUND,
        message: "Usuario nao encontrado.",
        details: { userId },
      });
    }

    return res.json({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      type: "access" as const,
      name: user.name ?? user.email,
    });
  } catch (err) {
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao obter dados do usuario.",
      details: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
});

/**
 * POST /auth/refresh
 * Body: { refresh }
 * Valida o refresh (via hash em Session) e emite novo par de tokens.
 */
authRouter.post("/refresh", async (req, res) => {
  const { refresh } = (req.body ?? {}) as { refresh?: string };
  if (!refresh) {
    return respondWithError(res, {
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: "Refresh token requerido.",
    });
  }

  let payload;
  try {
    payload = verifyRefresh(refresh);
  } catch {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.REFRESH_INVALID,
      message: "Refresh invalido.",
    });
  }

  // busca todas as sessoes do usuario (poderia otimizar com expiresAt > now)
  const sessions = await TenantContext.run(payload.tid, () =>
    prisma.session.findMany({ where: { userId: payload.sub } })
  );
  if (!sessions.length) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.SESSION_NOT_FOUND,
      message: "Refresh nao encontrado.",
      details: { userId: payload.sub },
    });
  }

  const ok = await Promise.any(
    sessions.map((session) => argon2.verify(session.refreshHash, refresh))
  ).catch(() => false);

  if (!ok) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.REFRESH_INVALID,
      message: "Refresh invalido.",
    });
  }

  // emite novos tokens com o mesmo tenant/role do payload
  const tokens = await TenantContext.run(payload.tid, () =>
    issueTokens({ id: payload.sub, tenantId: payload.tid, role: payload.role })
  );
  return res.json(tokens);
});

/**
 * POST /auth/logout
 * Header: Authorization: Bearer <access>
 * Revoga TODAS as sessoes do usuario.
 */
authRouter.post("/logout", jwtAuth(false), async (req, res) => {
  if (!req.user) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.UNAUTHENTICATED,
      message: "Nao autenticado.",
    });
  }
  await TenantContext.run(req.user.tenantId, () =>
    revokeAllUserSessions(req.user!.userId)
  );
  return res.json({ ok: true });
});

const genericResetResponse = {
  message: "Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.",
};

/**
 * POST /auth/forgot-password
 */
authRouter.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    const { email } = req.body as { email: string };

    const user = await basePrisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return res.json(genericResetResponse);
    }

    const rawToken = await createPasswordResetTokenForUser(user.id);
    const baseUrl = env.APP_WEB_URL.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? user.email,
      resetUrl,
    });

    return res.json(genericResetResponse);
  },
);

/**
 * POST /auth/reset-password
 */
authRouter.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  async (req, res) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string };

    try {
      await resetUserPasswordFromToken(token, newPassword);
      return res.json({
        message: "Senha redefinida com sucesso. Faça login novamente.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      if (message === "TOKEN_INVALID") {
        return respondWithError(res, {
          status: 400,
          code: ErrorCodes.TOKEN_INVALID,
          message: "Token inválido ou expirado.",
        });
      }

      return respondWithError(res, {
        status: 500,
        code: ErrorCodes.INTERNAL,
        message: "Erro ao redefinir a senha.",
      });
    }
  },
);
