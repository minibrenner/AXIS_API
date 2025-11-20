"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantSchema = exports.createTenantSchema = void 0;
const zod_1 = require("zod");
// helpers para normalizar nǧmeros
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const CnpjSchema = zod_1.z
    .string()
    .transform(digits)
    .refine((v) => v.length === 0 || v.length === 14, { message: "CNPJ deve ter 14 digitos" })
    .transform((v) => (v.length === 0 ? undefined : v));
const CpfSchema = zod_1.z
    .string()
    .transform(digits)
    .refine((v) => v.length === 0 || v.length === 11, { message: "CPF deve ter 11 digitos" })
    .transform((v) => (v.length === 0 ? undefined : v));
const maxCashSessionsSchema = zod_1.z
    .number()
    .int()
    .min(1, "É necessário permitir pelo menos 1 caixa")
    .max(100, "O número máximo de caixas não pode exceder 100")
    .optional();
exports.createTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "name mínimo 2 caracteres"),
    email: zod_1.z.string().email("email inválido"),
    cnpj: CnpjSchema.optional(),
    cpfResLoja: CpfSchema.optional(),
    maxOpenCashSessions: maxCashSessionsSchema,
    // senha primária padrão, se ausente usaremos "1234" no controller
    password: zod_1.z.string().min(4, "password mínimo 4 caracteres").optional(),
});
exports.updateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    cnpj: CnpjSchema.optional(),
    cpfResLoja: CpfSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
    maxOpenCashSessions: maxCashSessionsSchema,
    // permitir troca de senha no update
    password: zod_1.z.string().min(4).optional(),
});
//# sourceMappingURL=tenant.schemas.js.map