"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminGuard = superAdminGuard;
const httpErrors_1 = require("../utils/httpErrors");
const auth_service_1 = require("../super-admin/auth.service");
function getBearer(req) {
    const header = req.header("authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.slice(7);
}
function superAdminGuard(req, _res, next) {
    const token = getBearer(req);
    if (!token) {
        return next(new httpErrors_1.HttpError({
            status: 401,
            code: httpErrors_1.ErrorCodes.UNAUTHENTICATED,
            message: "Token de super admin ausente.",
        }));
    }
    try {
        const payload = (0, auth_service_1.verifySuperAdminToken)(token);
        req.superAdmin = { email: payload.email };
        return next();
    }
    catch (err) {
        return next(new httpErrors_1.HttpError({
            status: 401,
            code: httpErrors_1.ErrorCodes.UNAUTHENTICATED,
            message: "Token de super admin invalido.",
            details: { reason: err instanceof Error ? err.message : "unknown" },
        }));
    }
}
//# sourceMappingURL=superAdmin.guard.js.map