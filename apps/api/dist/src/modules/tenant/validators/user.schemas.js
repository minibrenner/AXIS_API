"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
// Schemas Zod responsaveis por validar entradas do CRUD de usuarios dentro do tenant.
// Convertemos roles para maiusculas, garantimos enum valido e expomos tipos para uso no controller.
const zod_1 = require("zod");
// Enum base utilizado tanto para validar os inputs quanto para tipar o retorno.
const roleEnum = zod_1.z.enum(["ADMIN", "ATTENDANT", "OWNER"]);
// Aceita role em diversos formatos (string livre) e transforma em um valor do enum.
const roleInput = zod_1.z
    .union([
    roleEnum,
    zod_1.z.string().trim().transform((value) => value.toUpperCase()),
])
    .pipe(roleEnum);
// Payload aceito na criacao de usuarios: campos obrigatorios + flags opcionais.
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("email invalido"),
    password: zod_1.z.string().min(6, "password minimo 6 caracteres"),
    name: zod_1.z.string().min(2).optional(),
    role: roleInput.optional(),
    isActive: zod_1.z.boolean().optional(),
    mustChangePassword: zod_1.z.boolean().optional(),
});
// Payload aceito em atualizacoes: todos os campos opcionais para PATCH-like.
exports.updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("email invalido").optional(),
    password: zod_1.z.string().min(6, "password minimo 6 caracteres").optional(),
    name: zod_1.z.string().min(2).optional(),
    role: roleInput.optional(),
    isActive: zod_1.z.boolean().optional(),
    mustChangePassword: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=user.schemas.js.map