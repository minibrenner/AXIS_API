"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminLoginSchema = void 0;
const zod_1 = require("zod");
exports.superAdminLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email("email invalido"),
    password: zod_1.z.string().min(6, "password minimo 6 caracteres"),
});
//# sourceMappingURL=auth.schemas.js.map