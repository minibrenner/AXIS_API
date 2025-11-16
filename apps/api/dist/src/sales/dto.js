"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleSchema = exports.paymentSchema = exports.saleItemSchema = exports.discountInputSchema = void 0;
const zod_1 = require("zod");
exports.discountInputSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({
        type: zod_1.z.literal("value"),
        valueCents: zod_1.z.coerce.number().int().positive(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("percent"),
        percent: zod_1.z.coerce.number().positive().max(99),
    }),
]);
exports.saleItemSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    sku: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    qty: zod_1.z.coerce.number().positive(),
    unitPriceCents: zod_1.z.coerce.number().int().nonnegative(),
    discount: exports.discountInputSchema.optional(),
});
exports.paymentSchema = zod_1.z.object({
    method: zod_1.z.enum(["cash", "debit", "credit", "pix", "vr", "va", "store_credit"]),
    amountCents: zod_1.z.coerce.number().int().positive(),
    providerId: zod_1.z.string().optional(),
});
exports.saleSchema = zod_1.z.object({
    cashSessionId: zod_1.z.string(),
    locationId: zod_1.z.string().cuid(),
    items: zod_1.z.array(exports.saleItemSchema).min(1),
    payments: zod_1.z.array(exports.paymentSchema).min(1),
    discount: exports.discountInputSchema.optional(),
    fiscalMode: zod_1.z.enum(["sat", "nfce", "none"]).default("none"),
    saleId: zod_1.z.string().optional(),
});
//# sourceMappingURL=dto.js.map