"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerRouter = void 0;
const express_1 = require("express");
const ledger_service_1 = require("./ledger.service");
const rbac_1 = require("../security/rbac");
const zod_1 = require("zod");
const tenant_context_1 = require("../tenancy/tenant.context");
exports.ledgerRouter = (0, express_1.Router)();
const service = new ledger_service_1.LedgerService();
const chargeSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    description: zod_1.z.string().optional(),
    saleId: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().datetime().optional(),
});
const paymentSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    method: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
});
exports.ledgerRouter.post("/:id/ledger/charge", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const dto = chargeSchema.parse(req.body);
    const tenantId = req.user.tenantId;
    const r = await tenant_context_1.TenantContext.run(tenantId, () => service.charge({
        customerId: req.params.id,
        amount: dto.amount,
        description: dto.description,
        saleId: dto.saleId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        idempotencyKey: req.header("Idempotency-Key") ?? undefined,
        createdBy: req.user.userId,
    }));
    res.status(201).json(r);
});
exports.ledgerRouter.post("/:id/ledger/payment", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const dto = paymentSchema.parse(req.body);
    const tenantId = req.user.tenantId;
    const r = await tenant_context_1.TenantContext.run(tenantId, () => service.payment({
        customerId: req.params.id,
        amount: dto.amount,
        method: dto.method,
        description: dto.description,
        idempotencyKey: req.header("Idempotency-Key") ?? undefined,
        createdBy: req.user.userId,
    }));
    res.status(201).json(r);
});
exports.ledgerRouter.get("/:id/ledger/statement", async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const tenantId = req.user.tenantId;
    const out = await tenant_context_1.TenantContext.run(tenantId, () => service.statement(req.params.id, from, to));
    res.json(out);
});
//# sourceMappingURL=ledger.routes.js.map