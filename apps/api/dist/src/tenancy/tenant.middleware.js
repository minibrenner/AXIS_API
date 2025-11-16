"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = tenantMiddleware;
const tenant_context_1 = require("./tenant.context");
const httpErrors_1 = require("../utils/httpErrors");
function resolveTenant(req) {
    const tenantFromUser = (req.user && (req.user.tid || req.user.tenantId));
    const tenantFromHeader = req.headers["x-tenant-id"];
    const tenantFromParams = req.params?.tenantId;
    return tenantFromUser || tenantFromHeader || tenantFromParams;
}
function enterTenantScope(tenantId, next) {
    if (tenant_context_1.TenantContext.get() === tenantId) {
        next();
        return;
    }
    tenant_context_1.TenantContext.run(tenantId, () => next());
}
/**
 * Middleware responsavel por descobrir o tenant atual e salva-lo em:
 * - `req.tenantId`, facilitando o uso nas rotas/controllers.
 * - `TenantContext`, que alimenta o middleware do Prisma.
 *
 * Ele procura o tenant em `req.user` (quando autenticacao estiver ativa) ou no
 * header `x-tenant-id` (util para ambientes de desenvolvimento e testes).
 */
function tenantMiddleware(req, _res, next) {
    const tenantId = resolveTenant(req);
    if (!tenantId) {
        return next(new httpErrors_1.HttpError({
            status: 400,
            code: httpErrors_1.ErrorCodes.TENANT_NOT_RESOLVED,
            message: "Tenant nao identificado.",
        }));
    }
    req.tenantId = tenantId;
    enterTenantScope(tenantId, next);
}
//# sourceMappingURL=tenant.middleware.js.map