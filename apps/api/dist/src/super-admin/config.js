"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuperAdminEnv = getSuperAdminEnv;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
const ENV_FILENAMES = [".env.superadmin", ".env"];
let cachedEnv = null;
function findEnvFile(fileName) {
    let currentDir = __dirname;
    const { root } = node_path_1.default.parse(currentDir);
    while (true) {
        const candidate = node_path_1.default.resolve(currentDir, fileName);
        if (node_fs_1.default.existsSync(candidate)) {
            return candidate;
        }
        if (currentDir === root) {
            break;
        }
        currentDir = node_path_1.default.dirname(currentDir);
    }
    return null;
}
function ensureEnvLoaded() {
    if (cachedEnv) {
        return;
    }
    for (const name of ENV_FILENAMES) {
        const envPath = findEnvFile(name);
        if (envPath) {
            (0, dotenv_1.config)({ path: envPath, override: false });
        }
    }
}
function getSuperAdminEnv() {
    if (cachedEnv) {
        return cachedEnv;
    }
    ensureEnvLoaded();
    const email = process.env.SUPER_ADMIN_EMAIL;
    const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;
    const passwordPlain = process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_KEY;
    const tokenSecret = process.env.SUPER_ADMIN_TOKEN_SECRET ||
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_REFRESH_SECRET;
    const tokenTtl = process.env.SUPER_ADMIN_TOKEN_TTL || "30m";
    if (!email) {
        throw new Error("SUPER_ADMIN_EMAIL nao configurado. Defina-o no arquivo .env.superadmin (gitignored).");
    }
    if (!passwordHash && !passwordPlain) {
        throw new Error("Configure SUPER_ADMIN_PASSWORD ou SUPER_ADMIN_PASSWORD_HASH nas variaveis de ambiente.");
    }
    if (!tokenSecret) {
        throw new Error("SUPER_ADMIN_TOKEN_SECRET ou JWT_ACCESS_SECRET nao configurado. Defina um segredo para tokens do super admin.");
    }
    cachedEnv = {
        email,
        passwordHash,
        passwordPlain,
        tokenSecret,
        tokenTtl,
    };
    return cachedEnv;
}
//# sourceMappingURL=config.js.map