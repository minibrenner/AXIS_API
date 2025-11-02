"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapOwnerGuard = void 0;
const client_1 = require("../../../prisma/client");
const middleware_1 = require("../../../auth/middleware");
const httpErrors_1 = require("../../../utils/httpErrors");
const authenticatedGuard = (0, middleware_1.jwtAuth)(true);
const roleGuard = (0, middleware_1.requireRole)("ADMIN", "OWNER");
/**
 * Permite criar o primeiro OWNER de um tenant sem token.
 * - Se houver Authorization, delega para jwtAuth + requireRole normalmente.
 * - Sem Authorization, valida que o tenant existe e não possui usuários/owner.
 */
const bootstrapOwnerGuard = async (req, res, next) => {
    const hasAuthorization = Boolean(req.headers.authorization);
    if (hasAuthorization) {
        return authenticatedGuard(req, res, (authError) => {
            if (authError) {
                return next(authError);
            }
            return roleGuard(req, res, next);
        });
    }
    const tenantId = req.tenantId;
    if (!tenantId) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 400,
            code: httpErrors_1.ErrorCodes.TENANT_NOT_RESOLVED,
            message: "Tenant nao identificado.",
        });
    }
    try {
        const tenant = await client_1.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { ownerUserId: true },
        });
        if (!tenant) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 404,
                code: httpErrors_1.ErrorCodes.TENANT_NOT_FOUND,
                message: "Tenant nao encontrado.",
                details: { tenantId },
            });
        }
        if (tenant.ownerUserId) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 401,
                code: httpErrors_1.ErrorCodes.BOOTSTRAP_LOCKED,
                message: "Bootstrap de owner nao esta mais disponivel para este tenant.",
            });
        }
        const userCount = await client_1.prisma.user.count({ where: { tenantId } });
        if (userCount > 0) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 401,
                code: httpErrors_1.ErrorCodes.BOOTSTRAP_LOCKED,
                message: "Bootstrap de owner ja foi utilizado. Realize login para criar novos usuarios.",
            });
        }
        req.isBootstrapOwnerCreation = true;
        return next();
    }
    catch (error) {
        console.error("Falha ao validar bootstrap de owner:", error);
        return (0, httpErrors_1.respondWithError)(res, {
            status: 500,
            code: httpErrors_1.ErrorCodes.INTERNAL,
            message: "Falha ao validar tenant.",
        });
    }
};
exports.bootstrapOwnerGuard = bootstrapOwnerGuard;
//# sourceMappingURL=bootstrapOwner.guard.js.map