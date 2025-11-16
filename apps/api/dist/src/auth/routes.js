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
const httpErrors_1 = require("../utils/httpErrors");
const tenant_context_1 = require("../tenancy/tenant.context");
exports.authRouter = (0, express_1.Router)();
/**
 * POST /auth/login
 * Body: { email, password }
 */
exports.authRouter.post("/login", async (req, res) => {
    const { email, password } = (req.body ?? {});
    const missing = [];
    if (!email)
        missing.push("email");
    if (!password)
        missing.push("password");
    if (missing.length) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.BAD_REQUEST,
            message: "Campos email e password sao obrigatorios.",
            details: { missing },
        });
    }
    const user = await (0, auth_service_1.validateUser)(email, password);
    if (!user) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.INVALID_CREDENTIALS,
            message: "Credenciais invalidas.",
        });
    }
    const tokens = await tenant_context_1.TenantContext.run(user.tenantId, () => (0, auth_service_1.issueTokens)({ id: user.id, tenantId: user.tenantId, role: user.role }, req.get("user-agent") ?? "", req.ip));
    return res.json(tokens);
});
/**
 * GET /auth/me
 * Header: Authorization: Bearer <access>
 * Retorna dados basicos do portador do token.
 */
exports.authRouter.get("/me", (0, middleware_1.jwtAuth)(false), (req, res) => {
    // aqui nao exigimos tenant match porque e apenas introspeccao
    return res.json(req.user);
});
/**
 * POST /auth/refresh
 * Body: { refresh }
 * Valida o refresh (via hash em Session) e emite novo par de tokens.
 */
exports.authRouter.post("/refresh", async (req, res) => {
    const { refresh } = (req.body ?? {});
    if (!refresh) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.BAD_REQUEST,
            message: "Refresh token requerido.",
        });
    }
    let payload;
    try {
        payload = (0, jwt_1.verifyRefresh)(refresh);
    }
    catch {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.REFRESH_INVALID,
            message: "Refresh invalido.",
        });
    }
    // busca todas as sessoes do usuario (poderia otimizar com expiresAt > now)
    const sessions = await tenant_context_1.TenantContext.run(payload.tid, () => client_1.prisma.session.findMany({ where: { userId: payload.sub } }));
    if (!sessions.length) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.SESSION_NOT_FOUND,
            message: "Refresh nao encontrado.",
            details: { userId: payload.sub },
        });
    }
    const ok = await Promise.any(sessions.map((session) => argon2_1.default.verify(session.refreshHash, refresh))).catch(() => false);
    if (!ok) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.REFRESH_INVALID,
            message: "Refresh invalido.",
        });
    }
    // emite novos tokens com o mesmo tenant/role do payload
    const tokens = await tenant_context_1.TenantContext.run(payload.tid, () => (0, auth_service_1.issueTokens)({ id: payload.sub, tenantId: payload.tid, role: payload.role }));
    return res.json(tokens);
});
/**
 * POST /auth/logout
 * Header: Authorization: Bearer <access>
 * Revoga TODAS as sessoes do usuario.
 */
exports.authRouter.post("/logout", (0, middleware_1.jwtAuth)(false), async (req, res) => {
    if (!req.user) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.UNAUTHENTICATED,
            message: "Nao autenticado.",
        });
    }
    await tenant_context_1.TenantContext.run(req.user.tenantId, () => (0, auth_service_1.revokeAllUserSessions)(req.user.userId));
    return res.json({ ok: true });
});
//# sourceMappingURL=routes.js.map