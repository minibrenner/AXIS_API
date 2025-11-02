"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSchema = exports.loginSchema = void 0;
// apps/api/src/auth/validators/auth.schemas.ts
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.refreshSchema = zod_1.z.object({
    refresh: zod_1.z.string().min(10),
});
//# sourceMappingURL=auth.schemas.js.map