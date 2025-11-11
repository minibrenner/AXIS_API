"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
// apps/api/src/reports/routes.ts (resumo)
const express_1 = require("express");
const client_1 = require("@prisma/client");
const client_2 = require("../prisma/client");
const middleware_1 = require("../auth/middleware");
const zod_1 = require("zod");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.use(middleware_1.jwtAuth);
// GET /reports/min-stock?bufferPct=10
exports.reportsRouter.get("/min-stock", async (req, res) => {
    const qp = zod_1.z.object({
        bufferPct: zod_1.z.coerce.number().min(0).max(100).default(10),
        locationId: zod_1.z.string().optional(),
        productId: zod_1.z.string().optional(),
    }).parse(req.query);
    const rows = await client_2.prisma.inventory.findMany({
        where: {
            tenantId: req.user.tenantId,
            locationId: qp.locationId,
            productId: qp.productId,
        },
        include: { product: true, location: true },
    });
    const buffer = new client_1.Prisma.Decimal(1).plus(new client_1.Prisma.Decimal(qp.bufferPct).div(100));
    const flagged = rows
        .map((r) => {
        const minEff = r.product.minStock ?? null;
        if (minEff === null)
            return null;
        const qty = new client_1.Prisma.Decimal(r.quantity);
        const min = new client_1.Prisma.Decimal(minEff);
        const nearThreshold = min.mul(buffer); // min * (1 + buffer%)
        let status = null;
        if (qty.lt(min))
            status = "LOW";
        else if (qty.lte(nearThreshold))
            status = "NEAR";
        if (!status)
            return null;
        const ratio = qty.div(min); // para ordenar por urgência
        return {
            id: r.id,
            product: r.product,
            location: r.location,
            quantity: qty.toString(),
            minEffective: min.toString(),
            nearThreshold: nearThreshold.toString(),
            status,
            ratio: ratio.toNumber(),
            gapToMin: qty.minus(min).toString(), // negativo = faltando
        };
    })
        .filter((item) => Boolean(item))
        .sort((a, b) => a.ratio - b.ratio); // mais crítico primeiro
    res.json({ items: flagged, bufferPct: qp.bufferPct });
});
exports.reportsRouter.get("/top-sold", async (req, res) => {
    const qp = zod_1.z.object({
        from: zod_1.z.string().optional(),
        to: zod_1.z.string().optional()
    }).parse(req.query);
    const from = qp.from ? new Date(qp.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = qp.to ? new Date(qp.to) : new Date();
    const rows = await client_2.prisma.stockMovement.groupBy({
        by: ["productId"],
        where: { tenantId: req.user.tenantId, type: "OUT", createdAt: { gte: from, lte: to } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10
    });
    const products = await client_2.prisma.product.findMany({ where: { id: { in: rows.map(r => r.productId) } } });
    const map = new Map(products.map(p => [p.id, p]));
    res.json(rows.map(r => ({ product: map.get(r.productId), totalOut: r._sum.quantity })));
});
exports.reportsRouter.get("/bad-sold", async (req, res) => {
    const qp = zod_1.z.object({
        from: zod_1.z.string().optional(),
        to: zod_1.z.string().optional()
    }).parse(req.query);
    const from = qp.from ? new Date(qp.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = qp.to ? new Date(qp.to) : new Date();
    const rows = await client_2.prisma.stockMovement.groupBy({
        by: ["productId"],
        where: { tenantId: req.user.tenantId, type: "OUT", createdAt: { gte: from, lte: to } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "asc" } },
        take: 10
    });
    const products = await client_2.prisma.product.findMany({ where: { id: { in: rows.map(r => r.productId) } } });
    const map = new Map(products.map(p => [p.id, p]));
    res.json(rows.map(r => ({ product: map.get(r.productId), totalOut: r._sum.quantity })));
});
//# sourceMappingURL=routes.js.map