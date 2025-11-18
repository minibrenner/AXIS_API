// apps/api/src/auth/auth.service.ts
// Serviço central de autenticação: valida logins, emite tokens JWT e persiste sessões de refresh.
import argon2 from "argon2";
import { basePrisma, prisma } from "../prisma/client";
import { signAccess, signRefresh } from "./jwt";
import { generateResetToken, hashResetToken } from "./passwordReset";

/**
 * Faz a autenticação básica de um usuário a partir do e-mail e da senha.
 *
 * @param email - Credencial usada para localizar o usuário no banco.
 * @param password - Senha em texto plano digitada no formulário de login.
 * @returns Instância do usuário quando a senha confere e o usuário está ativo; caso contrário null.
 */
export async function validateUser(email: string, password: string) {
  const user = await basePrisma.user.findFirst({ where: { email } });
  if (!user || !user.isActive) return null;

  const ok = await argon2.verify(user.passwordHash, password);
  return ok ? user : null;
}

/**
 * Emite um par de tokens (acesso + refresh) e registra a sessão de refresh no banco.
 */
export async function issueTokens(
  user: { id: string; tenantId: string; role: string },
  userAgent?: string,
  ip?: string,
  refreshTtlMs = 1000 * 60 * 60 * 24 * 7, // 7 dias default
) {
  const payload = { sub: user.id, tid: user.tenantId, role: user.role };
  const access = signAccess(payload);
  const refresh = signRefresh(payload);
  const refreshHash = await argon2.hash(refresh);

  await prisma.session.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      refreshHash,
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + refreshTtlMs),
    },
  });

  return { access, refresh };
}

/**
 * Revoga todas as sessões (tokens de refresh persistidos) de um usuário específico.
 */
export async function revokeAllUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Gera e persiste um token de redefinição para um usuário específico.
 */
export async function createPasswordResetTokenForUser(userId: string) {
  await basePrisma.passwordResetToken.deleteMany({ where: { userId } });

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  await basePrisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Consome um token de reset e define a nova senha do usuário.
 */
export async function resetUserPasswordFromToken(token: string, newPassword: string) {
  const tokenHash = hashResetToken(token);

  const reset = await basePrisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!reset || !reset.user) {
    throw new Error("TOKEN_INVALID");
  }

  const passwordHash = await argon2.hash(newPassword);

  await basePrisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: reset.user!.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false,
      },
    });

    await tx.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        userId: reset.user!.id,
        id: { not: reset.id },
      },
    });

    await tx.session.deleteMany({
      where: { userId: reset.user!.id },
    });
  });

  return {
    userId: reset.user.id,
    tenantId: reset.user.tenantId,
    role: reset.user.role,
  };
}
