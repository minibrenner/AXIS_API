"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySupervisorPIN = verifySupervisorPIN;
const argon2_1 = __importDefault(require("argon2"));
const client_1 = require("../prisma/client");
/**
 * Verifica o PIN de supervisor de um usuário.
 * Suporta PIN armazenado em texto plano ou em hash Argon2 (preferível em produção).
 */
async function verifySupervisorPIN(userId, pin) {
    const user = await client_1.prisma.user.findUnique({
        where: { id: userId },
        select: { pinSupervisor: true },
    });
    if (!user?.pinSupervisor) {
        return false;
    }
    const stored = user.pinSupervisor;
    if (stored.startsWith("$argon2")) {
        try {
            return await argon2_1.default.verify(stored, pin);
        }
        catch {
            return false;
        }
    }
    return stored === pin;
}
//# sourceMappingURL=pin.js.map