"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResetToken = generateResetToken;
exports.hashResetToken = hashResetToken;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Gera um par de valores para reset de senha.
 * rawToken é enviado ao usuário via link seguro; tokenHash fica persistido.
 */
function generateResetToken() {
    const rawToken = node_crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = node_crypto_1.default.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, tokenHash };
}
/**
 * Converte um token recebido do cliente para hash comparável.
 */
function hashResetToken(token) {
    return node_crypto_1.default.createHash("sha256").update(token).digest("hex");
}
//# sourceMappingURL=passwordReset.js.map