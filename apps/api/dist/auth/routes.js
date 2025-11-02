"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// apps/api/src/auth/routes.ts
const express_1 = require("express");
const argon2_1 = __importDefault(require("argon2"));
const client_1 = require("../prisma/client");
const auth_service_1 = require("./auth.service");
const jwt_1 = require("./jwt");
const middleware_1 = require("./middleware");
exports.authRouter = (0, express_1.Router)();
/**
 * POST /auth/login
 * Body: { email, password }
 */
exports.authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: "email e password são obrigatórios" });
    const user = await (0, auth_service_1.validateUser)(email, password);
    if (!user)
        return res.status(401).json({ error: "Credenciais inválidas" });
    const tokens = await (0, auth_service_1.issueTokens)({ id: user.id, tenantId: user.tenantId, role: user.role }, req.get("user-agent") ?? "", req.ip);
    return res.json(tokens);
});
/**
 * GET /auth/me
 * Header: Authorization: Bearer <access>
 * Retorna dados básicos do portador do token.
 */
exports.authRouter.get("/me", (0, middleware_1.jwtAuth)(false), (req, res) => {
    // aqui não exigimos tenant match pq é apenas introspecção
    return res.json(req.user);
});
/**
 * POST /auth/refresh
 * Body: { refresh }
 * Valida o refresh (via hash em Session) e emite novo par de tokens.
 */
exports.authRouter.post("/refresh", async (req, res) => {
    const { refresh } = req.body;
    if (!refresh)
        return res.status(400).json({ error: "refresh token requerido" });
    let payload;
    try {
        payload = (0, jwt_1.verifyRefresh)(refresh);
    }
    catch {
        return res.status(401).json({ error: "refresh inválido" });
    }
    // busca todas as sessões do usuário (poderia otimizar com expiresAt > now)
    const sessions = await client_1.prisma.session.findMany({ where: { userId: payload.sub } });
    if (!sessions.length)
        return res.status(401).json({ error: "refresh não encontrado" });
    const ok = await Promise.any(sessions.map((s) => argon2_1.default.verify(s.refreshHash, refresh))).catch(() => false);
    if (!ok)
        return res.status(401).json({ error: "refresh inválido" });
    // emite novos tokens com o mesmo tenant/role do payload
    const tokens = await (0, auth_service_1.issueTokens)({ id: payload.sub, tenantId: payload.tid, role: payload.role });
    return res.json(tokens);
});
/**
 * POST /auth/logout
 * Header: Authorization: Bearer <access>
 * Revoga TODAS as sessões do usuário.
 */
exports.authRouter.post("/logout", (0, middleware_1.jwtAuth)(false), async (req, res) => {
    if (!req.user)
        return res.status(401).json({ error: "não autenticado" });
    await (0, auth_service_1.revokeAllUserSessions)(req.user.userId);
    return res.json({ ok: true });
});
//# sourceMappingURL=routes.js.map