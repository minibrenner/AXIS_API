"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const rbac_1 = require("../security/rbac");
const dto_1 = require("./dto");
const sales_service_1 = require("./sales.service");
const receipt_1 = require("./receipt");
const createSaleSchema = zod_1.z.object({
    sale: dto_1.saleSchema,
    supervisorSecret: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
const cancelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(280),
    supervisorSecret: zod_1.z.string().optional(),
});
exports.salesRouter = (0, express_1.Router)();
exports.salesRouter.post("/", (0, rbac_1.allowRoles)("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
    const { sale, supervisorSecret, idempotencyKey } = createSaleSchema.parse(req.body);
    const headerSecret = req.header("x-supervisor-secret") ?? undefined;
    const headerIdempotency = req.header("x-idempotency-key") ?? undefined;
    const response = await (0, sales_service_1.createSale)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        userRole: req.user.role,
        body: sale,
        supervisorSecret: supervisorSecret ?? headerSecret,
        idempotencyKey: idempotencyKey ?? headerIdempotency,
    });
    if ("duplicate" in response) {
        return res.status(200).json(response);
    }
    return res.status(201).json(response);
});
exports.salesRouter.post("/:saleId/cancel", (0, rbac_1.allowRoles)("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
    const { saleId } = req.params;
    const body = cancelSchema.parse(req.body ?? {});
    const supervisorSecret = body.supervisorSecret ?? req.header("x-supervisor-secret") ?? undefined;
    const sale = await (0, sales_service_1.cancelSale)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        saleId,
        reason: body.reason,
        approvalSecret: supervisorSecret,
    });
    return res.json(sale);
});
exports.salesRouter.get("/:saleId/receipt", (0, rbac_1.allowRoles)("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
    const payload = await (0, receipt_1.buildReceipt)(req.user.tenantId, req.params.saleId);
    return res.json(payload);
});
exports.default = exports.salesRouter;
//# sourceMappingURL=routes.js.map