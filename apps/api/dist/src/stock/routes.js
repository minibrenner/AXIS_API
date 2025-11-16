"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const rbac_1 = require("../security/rbac");
const service_1 = require("./service");
const client_2 = require("../prisma/client");
const httpErrors_1 = require("../utils/httpErrors");
const inSchema = zod_1.z.object({
    productId: zod_1.z.string(),
    locationId: zod_1.z.string(),
    qty: zod_1.z.coerce.number().positive(),
    reason: zod_1.z.string().optional(),
});
const outSchema = inSchema.extend({ saleId: zod_1.z.string().optional() });
const adjSchema = zod_1.z.object({
    productId: zod_1.z.string(),
    locationId: zod_1.z.string(),
    qty: zod_1.z.coerce.number(),
    reason: zod_1.z.string().optional(),
});
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
const locationBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80),
});
const locationParamSchema = zod_1.z.object({
    locationId: zod_1.z.string().cuid(),
});
exports.stockRouter = (0, express_1.Router)();
exports.stockRouter.post("/in", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = inSchema.parse(req.body);
    const result = await (0, service_1.stockIn)({ tenantId: req.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true, quantity: result.quantity.toString() });
});
exports.stockRouter.post("/out", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const body = outSchema.parse(req.body);
    const result = await (0, service_1.stockOut)({ tenantId: req.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
});
exports.stockRouter.post("/adjust", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = adjSchema.parse(req.body);
    const result = await (0, service_1.stockAdjust)({ tenantId: req.tenantId, userId: req.user.userId, ...body });
    res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
});
exports.stockRouter.get("/", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const data = await (0, service_1.listStock)(req.tenantId, query.productId, query.locationId);
    res.json({
        items: data.map((d) => ({
            ...d,
            quantity: d.quantity.toString(),
        })),
    });
});
exports.stockRouter.get("/movements", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const data = await (0, service_1.listStockMovements)(req.tenantId, query.productId, query.locationId);
    res.json({
        items: data.map((m) => ({
            ...m,
            quantity: m.quantity,
        })),
    });
});
exports.stockRouter.get("/level", (0, rbac_1.allowRoles)("ADMIN", "ATTENDANT"), async (req, res) => {
    const query = levelQuerySchema.parse(req.query);
    const qty = await (0, service_1.getStockLevel)(req.tenantId, query.productId, query.locationId);
    res.json({ quantity: qty.toString() });
});
exports.stockRouter.post("/init", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = initBodySchema.parse(req.body);
    const row = await (0, service_1.initializeInventory)(req.tenantId, body.productId, body.locationId);
    res.status(201).json({ id: row.id, quantity: row.quantity.toString() });
});
exports.stockRouter.post("/init/bulk", (0, rbac_1.allowRoles)("ADMIN"), async (req, res) => {
    const body = initBulkBodySchema.parse(req.body);
    const results = await Promise.all(body.items.map((it) => (0, service_1.initializeInventory)(req.tenantId, it.productId, it.locationId)));
    res.status(201).json({
        items: results.map((r) => ({
            id: r.id,
            productId: r.productId,
            locationId: r.locationId,
            quantity: r.quantity.toString(),
        })),
    });
});
exports.stockRouter.get("/locations", (0, rbac_1.allowRoles)("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
    const items = await client_2.prisma.stockLocation.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { name: "asc" },
    });
    res.json({ items });
});
exports.stockRouter.post("/locations", (0, rbac_1.allowRoles)("ADMIN", "OWNER"), async (req, res) => {
    const { name } = locationBodySchema.parse(req.body);
    try {
        const location = await client_2.prisma.stockLocation.create({
            data: { tenantId: req.tenantId, name },
        });
        res.status(201).json(location);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new httpErrors_1.HttpError({
                status: 409,
                code: httpErrors_1.ErrorCodes.CONFLICT,
                message: "Ja existe um deposito com esse nome.",
            });
        }
        throw error;
    }
});
exports.stockRouter.put("/locations/:locationId", (0, rbac_1.allowRoles)("ADMIN", "OWNER"), async (req, res) => {
    const { locationId } = locationParamSchema.parse(req.params);
    const { name } = locationBodySchema.parse(req.body);
    const updated = await client_2.prisma.stockLocation.updateMany({
        where: { id: locationId, tenantId: req.tenantId },
        data: { name },
    });
    if (updated.count === 0) {
        throw new httpErrors_1.HttpError({
            status: 404,
            code: httpErrors_1.ErrorCodes.NOT_FOUND,
            message: "Deposito nao encontrado.",
        });
    }
    const location = await client_2.prisma.stockLocation.findFirst({
        where: { id: locationId, tenantId: req.tenantId },
    });
    res.json(location);
});
exports.stockRouter.delete("/locations/:locationId", (0, rbac_1.allowRoles)("ADMIN", "OWNER"), async (req, res) => {
    const { locationId } = locationParamSchema.parse(req.params);
    try {
        const removed = await client_2.prisma.stockLocation.deleteMany({
            where: { id: locationId, tenantId: req.tenantId },
        });
        if (removed.count === 0) {
            throw new httpErrors_1.HttpError({
                status: 404,
                code: httpErrors_1.ErrorCodes.NOT_FOUND,
                message: "Deposito nao encontrado.",
            });
        }
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
            throw new httpErrors_1.HttpError({
                status: 400,
                code: httpErrors_1.ErrorCodes.CONFLICT,
                message: "Deposito vinculado a inventarios nao pode ser removido.",
            });
        }
        throw error;
    }
    res.status(204).send();
});
exports.default = exports.stockRouter;
//# sourceMappingURL=routes.js.map