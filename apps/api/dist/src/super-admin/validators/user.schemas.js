"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantUserSchema = void 0;
const zod_1 = require("zod");
exports.createTenantUserSchema = zod_1.z.object({
    tenantIdentifier: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().min(2).optional(),
    role: zod_1.z.enum(["ADMIN", "OWNER"]).optional(),
    pinSupervisor: zod_1.z.string().trim().min(4).max(32).optional().nullable(),
});
//# sourceMappingURL=user.schemas.js.map