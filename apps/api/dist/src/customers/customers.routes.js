"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersRouter = void 0;
const express_1 = require("express");
const zodMiddleware_1 = require("../utils/zodMiddleware");
const dto_1 = require("./dto");
const customers_service_1 = require("./customers.service");
const rbac_1 = require("../security/rbac");
const zod_1 = require("zod");
const tenant_context_1 = require("../tenancy/tenant.context");
const service = new customers_service_1.CustomersService();
exports.customersRouter = (0, express_1.Router)();
const searchSchema = zod_1.z.object({ q: zod_1.z.string().optional(), active: zod_1.z.coerce.boolean().optional() });
exports.customersRouter.post("/", (0, rbac_1.allowRoles)("ADMIN"), (0, zodMiddleware_1.withZod)(dto_1.createCustomerSchema), async (req, res) => {
    const tenantId = req.user.tenantId;
    const created = await tenant_context_1.TenantContext.run(tenantId, () => service.create(req.body));
    res.status(201).json(created);
});
exports.customersRouter.get("/", async (req, res) => {
    const q = searchSchema.parse(req.query);
    const tenantId = req.user.tenantId;
    const list = await tenant_context_1.TenantContext.run(tenantId, () => service.list(q));
    res.json(list);
});
exports.customersRouter.get("/:id", async (req, res) => {
    const tenantId = req.user.tenantId;
    const c = await tenant_context_1.TenantContext.run(tenantId, () => service.get(req.params.id));
    res.json(c);
});
exports.customersRouter.patch("/:id", (0, rbac_1.allowRoles)("ADMIN"), (0, zodMiddleware_1.withZod)(dto_1.updateCustomerSchema), async (req, res) => {
    const tenantId = req.user.tenantId;
    const up = await tenant_context_1.TenantContext.run(tenantId, () => service.update(req.params.id, req.body));
    res.json(up);
});
//# sourceMappingURL=customers.routes.js.map