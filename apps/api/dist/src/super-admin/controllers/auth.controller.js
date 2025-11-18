"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSuperAdmin = void 0;
const httpErrors_1 = require("../../utils/httpErrors");
const auth_service_1 = require("../auth.service");
const loginSuperAdmin = async (req, res) => {
    const { email, password } = req.body;
    const isValid = await (0, auth_service_1.verifySuperAdminCredentials)(email, password);
    if (!isValid) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 401,
            code: httpErrors_1.ErrorCodes.INVALID_CREDENTIALS,
            message: "Credenciais de super admin invalidas.",
        });
    }
    const { token, expiresIn } = (0, auth_service_1.issueSuperAdminToken)();
    return res.json({
        token,
        tokenType: "Bearer",
        expiresIn,
    });
};
exports.loginSuperAdmin = loginSuperAdmin;
//# sourceMappingURL=auth.controller.js.map