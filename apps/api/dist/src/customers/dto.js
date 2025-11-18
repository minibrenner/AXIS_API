"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCustomerSchema = exports.createCustomerSchema = void 0;
const zod_1 = require("zod");
exports.createCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    document: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    allowCredit: zod_1.z.boolean().default(false),
    creditLimit: zod_1.z.string().optional(), // enviar "1500.00" (string)
    defaultDueDays: zod_1.z.number().int().min(0).max(180).optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateCustomerSchema = exports.createCustomerSchema.partial();
//# sourceMappingURL=dto.js.map