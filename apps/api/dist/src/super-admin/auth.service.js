"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySuperAdminCredentials = verifySuperAdminCredentials;
exports.issueSuperAdminToken = issueSuperAdminToken;
exports.verifySuperAdminToken = verifySuperAdminToken;
const node_crypto_1 = require("node:crypto");
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
function safeCompare(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    try {
        return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
    }
    catch {
        return false;
    }
}
async function verifySuperAdminCredentials(email, password) {
    const env = (0, config_1.getSuperAdminEnv)();
    if (!safeCompare(env.email, email)) {
        return false;
    }
    if (env.passwordHash) {
        try {
            return await argon2_1.default.verify(env.passwordHash, password);
        }
        catch {
            return false;
        }
    }
    if (env.passwordPlain) {
        return safeCompare(env.passwordPlain, password);
    }
    return false;
}
function issueSuperAdminToken() {
    const env = (0, config_1.getSuperAdminEnv)();
    const payload = {
        scope: "super-admin",
        email: env.email,
    };
    const options = {
        expiresIn: typeof env.tokenTtl === "number" ? env.tokenTtl : env.tokenTtl.toString(),
    };
    const token = jsonwebtoken_1.default.sign(payload, env.tokenSecret, options);
    return { token, expiresIn: env.tokenTtl };
}
function verifySuperAdminToken(token) {
    const env = (0, config_1.getSuperAdminEnv)();
    const payload = jsonwebtoken_1.default.verify(token, env.tokenSecret);
    if (payload.scope !== "super-admin") {
        throw new Error("Token nao pertence ao super admin.");
    }
    if (!safeCompare(payload.email, env.email)) {
        throw new Error("Token de super admin com email invalido.");
    }
    return payload;
}
//# sourceMappingURL=auth.service.js.map