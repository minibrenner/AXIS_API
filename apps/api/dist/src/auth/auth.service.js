"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUser = validateUser;
exports.issueTokens = issueTokens;
exports.revokeAllUserSessions = revokeAllUserSessions;
exports.createPasswordResetTokenForUser = createPasswordResetTokenForUser;
exports.resetUserPasswordFromToken = resetUserPasswordFromToken;
// apps/api/src/auth/auth.service.ts
// Serviço central de autenticação: valida logins, emite tokens JWT e persiste sessões de refresh.
const argon2_1 = __importDefault(require("argon2"));
const client_1 = require("../prisma/client");
const jwt_1 = require("./jwt");
const passwordReset_1 = require("./passwordReset");
/**
 * Faz a autenticação básica de um usuário a partir do e-mail e da senha.
 *
 * @param email - Credencial usada para localizar o usuário no banco.
 * @param password - Senha em texto plano digitada no formulário de login.
 * @returns Instância do usuário quando a senha confere e o usuário está ativo; caso contrário null.
 */
async function validateUser(email, password) {
    const user = await client_1.basePrisma.user.findFirst({ where: { email } });
    if (!user || !user.isActive)
        return null;
    const ok = await argon2_1.default.verify(user.passwordHash, password);
    return ok ? user : null;
}
/**
 * Emite um par de tokens (acesso + refresh) e registra a sessão de refresh no banco.
 */
async function issueTokens(user, userAgent, ip, refreshTtlMs = 1000 * 60 * 60 * 24 * 7) {
    const payload = { sub: user.id, tid: user.tenantId, role: user.role };
    const access = (0, jwt_1.signAccess)(payload);
    const refresh = (0, jwt_1.signRefresh)(payload);
    const refreshHash = await argon2_1.default.hash(refresh);
    await client_1.prisma.session.create({
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
async function revokeAllUserSessions(userId) {
    await client_1.prisma.session.deleteMany({ where: { userId } });
}
/**
 * Gera e persiste um token de redefinição para um usuário específico.
 */
async function createPasswordResetTokenForUser(userId) {
    await client_1.basePrisma.passwordResetToken.deleteMany({ where: { userId } });
    const { rawToken, tokenHash } = (0, passwordReset_1.generateResetToken)();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    await client_1.basePrisma.passwordResetToken.create({
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
async function resetUserPasswordFromToken(token, newPassword) {
    const tokenHash = (0, passwordReset_1.hashResetToken)(token);
    const reset = await client_1.basePrisma.passwordResetToken.findFirst({
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
    const passwordHash = await argon2_1.default.hash(newPassword);
    await client_1.basePrisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: reset.user.id },
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
                userId: reset.user.id,
                id: { not: reset.id },
            },
        });
        await tx.session.deleteMany({
            where: { userId: reset.user.id },
        });
    });
    return {
        userId: reset.user.id,
        tenantId: reset.user.tenantId,
        role: reset.user.role,
    };
}
//# sourceMappingURL=auth.service.js.map