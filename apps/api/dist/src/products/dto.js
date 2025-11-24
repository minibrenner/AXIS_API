"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    sku: zod_1.z.string().optional().default(""),
    barcode: zod_1.z.string().optional(),
    unit: zod_1.z.enum(["UN", "CX", "KG", "LT", "GR", "ML", "PC"]).default("UN"),
    price: zod_1.z.string().regex(/^\d+([.,]\d{1,2})?$/, "use string decimal com . ou ,"),
    cost: zod_1.z.string().regex(/^\d+([.,]\d{1,2})?$/).optional(),
    categoryId: zod_1.z.string().optional(),
    minStock: zod_1.z.string().regex(/^\d+([.,]\d{1,3})?$/).optional(),
    ncm: zod_1.z.string().optional(),
    cest: zod_1.z.string().optional(),
    csosn: zod_1.z.string().optional(),
    cfop: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.updateProductSchema = exports.createProductSchema.partial();
//# sourceMappingURL=dto.js.map