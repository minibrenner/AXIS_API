"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminGuard = superAdminGuard;
const dotenv_1 = require("dotenv");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const httpErrors_1 = require("../utils/httpErrors");
const ENV_PATH = node_path_1.default.resolve(process.cwd(), ".env.superadmin");
if (!process.env.SUPER_ADMIN_KEY && node_fs_1.default.existsSync(ENV_PATH)) {
    (0, dotenv_1.config)({ path: ENV_PATH, override: false });
}
const HEADER_NAME = "Lu102030@";
function resolveSecret() {
    const secret = process.env.SUPER_ADMIN_KEY;
    if (!secret) {
        throw new Error("SUPER_ADMIN_KEY não configurada. Configure o segredo antes de usar as rotas de super admin.");
    }
    return secret;
}
function superAdminGuard(req, _res, next) {
    const provided = req.header(HEADER_NAME);
    const expected = resolveSecret();
    if (!provided || provided !== expected) {
        return next(new httpErrors_1.HttpError({
            status: 401,
            code: httpErrors_1.ErrorCodes.UNAUTHENTICATED,
            message: "Credencial de super admin inválida.",
        }));
    }
    return next();
}
//# sourceMappingURL=superAdmin.guard.js.map