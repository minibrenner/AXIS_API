"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccess = signAccess;
exports.signRefresh = signRefresh;
exports.verifyAccess = verifyAccess;
exports.verifyRefresh = verifyRefresh;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
/**
 * Assina um token de acesso (curta duracao) com o segredo definido em JWT_ACCESS_SECRET.
 *
 * @param payload Dados do usuario que serao embedados no token.
 */
function signAccess(payload) {
    const expiresIn = env_1.env.JWT_ACCESS_TTL;
    return jsonwebtoken_1.default.sign({ ...payload, type: 'access' }, env_1.env.JWT_ACCESS_SECRET, { expiresIn });
}
/**
 * Assina um token de refresh (longa duracao) com o segredo JWT_REFRESH_SECRET.
 *
 * @param payload Mesmo payload do token de acesso; o type eh forcado para "refresh".
 */
function signRefresh(payload) {
    const expiresIn = env_1.env.JWT_REFRESH_TTL;
    return jsonwebtoken_1.default.sign({ ...payload, type: 'refresh' }, env_1.env.JWT_REFRESH_SECRET, { expiresIn });
}
/**
 * Valida a assinatura do token de acesso e retorna as claims originais.
 */
function verifyAccess(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
}
/**
 * Valida a assinatura do token de refresh e retorna as claims originais.
 */
function verifyRefresh(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
}
//# sourceMappingURL=jwt.js.map