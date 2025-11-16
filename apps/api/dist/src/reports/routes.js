"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
// apps/api/src/reports/routes.ts
const express_1 = require("express");
const client_1 = require("../prisma/client");
const middleware_1 = require("../auth/middleware");
const zod_1 = require("zod");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.use(middleware_1.jwtAuth);
/**
 * GET /reports/min-stock?bufferPct=10&locationId=&productId=&limit=200
 * Retorna estoque abaixo do mínimo (LOW) e até buffer% acima do mínimo (NEAR).
 * Tudo filtrado/ordenado no banco. Traaz somente campos necessários.
 */
exports.reportsRouter.get("/min-stock", async (req, res) => {
    const qp = zod_1.z.object({
        bufferPct: zod_1.z.coerce.number().min(0).max(100).default(10),
        locationId: zod_1.z.string().optional(),
        productId: zod_1.z.string().optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(500).default(200),
    }).parse(req.query);
    const factor = 1 + qp.bufferPct / 100;
    const rows = await client_1.prisma.$queryRaw `
    SELECT
      i.id  AS inv_id,
      i."productId"  AS product_id,
      i."locationId" AS location_id,
      i.quantity,
      COALESCE(i."minQuantity", p."minStock") AS min_eff,
      (i.quantity / COALESCE(i."minQuantity", p."minStock"))::float AS ratio,
      CASE
        WHEN i.quantity < COALESCE(i."minQuantity", p."minStock") THEN 'LOW'
        ELSE 'NEAR'
      END AS status,
      p.name AS product_name,
      p.sku  AS product_sku,
      l.name AS location_name
    FROM "Inventory" i
    JOIN "Product"  p ON p.id = i."productId"  AND p."tenantId" = i."tenantId"
    JOIN "Location" l ON l.id = i."locationId" AND l."tenantId" = i."tenantId"
    WHERE i."tenantId" = ${req.user.tenantId}
      AND (${qp.locationId} IS NULL OR i."locationId" = ${qp.locationId})
      AND (${qp.productId} IS NULL  OR i."productId"  = ${qp.productId})
      AND COALESCE(i."minQuantity", p."minStock") IS NOT NULL
      AND i.quantity <= COALESCE(i."minQuantity", p."minStock") * ${factor}
    ORDER BY ratio ASC
    LIMIT ${qp.limit}
  `;
    res.json({
        bufferPct: qp.bufferPct,
        items: rows.map(r => ({
            id: r.inv_id,
            product: { id: r.product_id, name: r.product_name, sku: r.product_sku },
            location: { id: r.location_id, name: r.location_name },
            quantity: r.quantity?.toString?.() ?? String(r.quantity),
            minEffective: r.min_eff?.toString?.() ?? String(r.min_eff),
            status: r.status, // "LOW" (<min) ou "NEAR" (<= min*(1+buffer))
            ratio: r.ratio, // <1 baixo do mínimo; 1..1+buffer perto do mínimo
            gapToMin: (Number(r.quantity) - Number(r.min_eff)).toString(),
        })),
    });
});
/**
 * GET /reports/top-sold?from=2025-10-01&to=2025-11-10&limit=10
 * Top produtos por saída (OUT) no período — join direto com Product (sem segunda query).
 */
exports.reportsRouter.get("/top-sold", async (req, res) => {
    const qp = zod_1.z.object({
        from: zod_1.z.coerce.date().optional(),
        to: zod_1.z.coerce.date().optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    }).parse(req.query);
    const from = qp.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = qp.to ?? new Date();
    const rows = await client_1.prisma.$queryRaw `
    SELECT
      sm."productId" AS product_id,
      SUM(sm.quantity) AS total_out,
      p.name AS product_name,
      p.sku  AS product_sku
    FROM "StockMovement" sm
    JOIN "Product" p
      ON p.id = sm."productId"
     AND p."tenantId" = sm."tenantId"
    WHERE sm."tenantId" = ${req.user.tenantId}
      AND sm.type = 'OUT'
      AND sm."createdAt" >= ${from}
      AND sm."createdAt" <= ${to}
    GROUP BY sm."productId", p.name, p.sku
    ORDER BY total_out DESC
    LIMIT ${qp.limit}
  `;
    res.json(rows.map(r => ({
        product: { id: r.product_id, name: r.product_name, sku: r.product_sku },
        totalOut: r.total_out?.toString?.() ?? String(r.total_out),
    })));
});
/**
 * GET /reports/bad-sold?from=...&to=...&limit=10
 * “Piores vendedores” (menos saída) no período — mesma ideia do top, invertendo ordenação.
 */
exports.reportsRouter.get("/bad-sold", async (req, res) => {
    const qp = zod_1.z.object({
        from: zod_1.z.coerce.date().optional(),
        to: zod_1.z.coerce.date().optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    }).parse(req.query);
    const from = qp.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = qp.to ?? new Date();
    const rows = await client_1.prisma.$queryRaw `
    SELECT
      sm."productId" AS product_id,
      SUM(sm.quantity) AS total_out,
      p.name AS product_name,
      p.sku  AS product_sku
    FROM "StockMovement" sm
    JOIN "Product" p
      ON p.id = sm."productId"
     AND p."tenantId" = sm."tenantId"
    WHERE sm."tenantId" = ${req.user.tenantId}
      AND sm.type = 'OUT'
      AND sm."createdAt" >= ${from}
      AND sm."createdAt" <= ${to}
    GROUP BY sm."productId", p.name, p.sku
    ORDER BY total_out ASC
    LIMIT ${qp.limit}
  `;
    // Observação: produtos com zero absoluto não aparecem. Para incluí-los, é preciso LEFT JOIN em Product e COALESCE(SUM,0).
    res.json(rows.map(r => ({
        product: { id: r.product_id, name: r.product_name, sku: r.product_sku },
        totalOut: r.total_out?.toString?.() ?? String(r.total_out),
    })));
});
//# sourceMappingURL=routes.js.map