"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowRoles = allowRoles;
const httpErrors_1 = require("../utils/httpErrors");
/**
 * Middleware genérico de RBAC que garante que o usuário autenticado possui uma das roles informadas.
 */
function allowRoles(...roles) {
    const allowed = new Set(roles);
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowed.has(role)) {
            return (0, httpErrors_1.respondWithError)(res, {
                status: 403,
                code: httpErrors_1.ErrorCodes.FORBIDDEN,
                message: "Acesso negado.",
                details: { requiredRoles: Array.from(allowed) },
            });
        }
        return next();
    };
}
//# sourceMappingURL=rbac.js.map