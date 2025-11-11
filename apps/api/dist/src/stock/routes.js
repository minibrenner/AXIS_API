"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
// apps/api/src/stock/routes.ts (resumo)
const express_1 = require("express");
const zod_1 = require("zod");
const middleware_1 = require("../auth/middleware");
const rbac_1 = require("../security/rbac");
const service_1 = require("./service");
const inSchema = zod_1.z.object({ productId: zod_1.z.string(), locationId: zod_1.z.string(), qty: zod_1.z.coerce.number().positive(), reason: zod_1.z.string().optional() });
const outSchema = inSchema.extend({ saleId: zod_1.z.string().optional() });
const adjSchema = zod_1.z.object({ productId: zod_1.z.string(), locationId: zod_1.z.string(), qty: zod_1.z.coerce.number(), reason: zod_1.z.string().optional() });
const listQuerySchema = zod_1.z.object({
    productId: zod_1.z.string().optional(),
    locationId: zod_1.z.string().optional(),
});
const levelQuerySchema = zod_1.z.object({
    productId: zod_1.z.string(),
    locationId: zod_1.z.string(),
});
const initBodySchema = zod_1.z.object({
    productId: zod_1.z.string(),
    locationId: zod_1.z.string(),
});
const initBulkBodySchema = zod_1.z.object({
    items: zod_1.z.array(initBodySchema),
});
exports.stockRouter = (0, express_1.Router)();
exports.stockRouter.use(middleware_1.jwtAuth);
// Entrada de estoque (ADMIN)
exports.stockRouter.post("/in", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = inSchema.parse(req.body);
    await (0, service_1.stockIn)({ tenantId: req.user.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true });
});
// Baixa por venda (idempotência a cargo do chamador ou usando refId único)
exports.stockRouter.post("/out", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const body = outSchema.parse(req.body);
    await (0, service_1.stockOut)({ tenantId: req.user.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true });
});
// Ajuste (requer PIN supervisor e ADMIN)
exports.stockRouter.post("/adjust", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = adjSchema.parse(req.body);
    // opcional: exigir PIN no header x-supervisor-pin e validar
    await (0, service_1.stockAdjust)({ tenantId: req.user.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true });
});
// Listar saldos de estoque
// GET /stock?productId=...&locationId=...
exports.stockRouter.get("/", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const data = await (0, service_1.listStock)(req.user.tenantId, query.productId, query.locationId);
    // quantity é Decimal — recomenda-se enviar como string para não perder precisão
    res.json({
        items: data.map((d) => ({
            ...d,
            quantity: d.quantity.toString(),
        })),
    });
});
// Listar movimentos de estoque (mais recentes primeiro)
// GET /stock/movements?productId=...&locationId=...
exports.stockRouter.get("/movements", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const data = await (0, service_1.listStockMovements)(req.user.tenantId, query.productId, query.locationId);
    res.json({
        items: data.map((m) => ({
            ...m,
            quantity: m.quantity, // aqui já é number no seu service (se vier como number), ajuste se for Decimal
        })),
    });
});
// Consultar nível de estoque (saldo atual) para um produto/local
// GET /stock/level?productId=...&locationId=...
exports.stockRouter.get("/level", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const query = levelQuerySchema.parse(req.query);
    const qty = await (0, service_1.getStockLevel)(req.user.tenantId, query.productId, query.locationId);
    res.json({ quantity: qty.toString() });
});
// Inicializar um inventário (cria se não existir com quantidade 0)
// POST /stock/init  { productId, locationId }
exports.stockRouter.post("/init", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = initBodySchema.parse(req.body);
    const row = await (0, service_1.initializeInventory)(req.user.tenantId, body.productId, body.locationId);
    res.status(201).json({ id: row.id, quantity: row.quantity.toString() });
});
// Inicializar em lote
// POST /stock/init/bulk  { items: [{ productId, locationId }, ...] }
exports.stockRouter.post("/init/bulk", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = initBulkBodySchema.parse(req.body);
    const results = await Promise.all(body.items.map((it) => (0, service_1.initializeInventory)(req.user.tenantId, it.productId, it.locationId)));
    res.status(201).json({
        items: results.map((r) => ({ id: r.id, productId: r.productId, locationId: r.locationId, quantity: r.quantity.toString() })),
    });
});
exports.default = exports.stockRouter;
//# sourceMappingURL=routes.js.map