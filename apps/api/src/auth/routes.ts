// apps/api/src/auth/routes.ts
import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "../prisma/client";
import { validateUser, issueTokens, revokeAllUserSessions } from "./auth.service";
import { verifyRefresh } from "./jwt";
import { jwtAuth } from "./middleware";

export const authRouter = Router();

/**
 * POST /auth/login
 * Body: { email, password }
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) return res.status(400).json({ error: "email e password são obrigatórios" });

  const user = await validateUser(email, password);
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const tokens = await issueTokens(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    req.get("user-agent") ?? "",
    req.ip
  );
  return res.json(tokens);
});

/**
 * GET /auth/me
 * Header: Authorization: Bearer <access>
 * Retorna dados básicos do portador do token.
 */
authRouter.get("/me", jwtAuth(false), (req, res) => {
  // aqui não exigimos tenant match pq é apenas introspecção
  return res.json(req.user);
});

/**
 * POST /auth/refresh
 * Body: { refresh }
 * Valida o refresh (via hash em Session) e emite novo par de tokens.
 */
authRouter.post("/refresh", async (req, res) => {
  const { refresh } = req.body as { refresh: string };
  if (!refresh) return res.status(400).json({ error: "refresh token requerido" });

  let payload;
  try {
    payload = verifyRefresh(refresh);
  } catch {
    return res.status(401).json({ error: "refresh inválido" });
  }

  // busca todas as sessões do usuário (poderia otimizar com expiresAt > now)
  const sessions = await prisma.session.findMany({ where: { userId: payload.sub } });
  if (!sessions.length) return res.status(401).json({ error: "refresh não encontrado" });

  const ok = await Promise.any(
    sessions.map((s) => argon2.verify(s.refreshHash, refresh))
  ).catch(() => false);

  if (!ok) return res.status(401).json({ error: "refresh inválido" });

  // emite novos tokens com o mesmo tenant/role do payload
  const tokens = await issueTokens(
    { id: payload.sub, tenantId: payload.tid, role: payload.role }
  );
  return res.json(tokens);
});

/**
 * POST /auth/logout
 * Header: Authorization: Bearer <access>
 * Revoga TODAS as sessões do usuário.
 */
authRouter.post("/logout", jwtAuth(false), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "não autenticado" });
  await revokeAllUserSessions(req.user.userId);
  return res.json({ ok: true });
});
