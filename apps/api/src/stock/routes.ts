// apps/api/src/stock/routes.ts (resumo)
import { Router } from "express";
import { z } from "zod";
import { jwtAuth } from "../auth/middleware";
import { allowRoles } from "../security/rbac";
import {
  stockIn,
  stockOut,
  stockAdjust,
  listStock,
  listStockMovements,
  getStockLevel,
  initializeInventory,
} from "./service";

const inSchema = z.object({ productId: z.string(), locationId: z.string(), qty: z.coerce.number().positive(), reason: z.string().optional() });
const outSchema = inSchema.extend({ saleId: z.string().optional() });
const adjSchema = z.object({ productId: z.string(), locationId: z.string(), qty: z.coerce.number(), reason: z.string().optional() });
const listQuerySchema = z.object({
  productId: z.string().optional(),
  locationId: z.string().optional(),
});
const levelQuerySchema = z.object({
  productId: z.string(),
  locationId: z.string(),
});
const initBodySchema = z.object({
  productId: z.string(),
  locationId: z.string(),
});
const initBulkBodySchema = z.object({
  items: z.array(initBodySchema),
});

export const stockRouter = Router();
stockRouter.use(jwtAuth());

// Entrada de estoque (ADMIN)
stockRouter.post("/in", allowRoles("ADMIN"), async (req, res) => {
  const body = inSchema.parse(req.body);
  await stockIn({ tenantId: req.user!.tenantId, userId: req.user!.userId, ...body });
  res.json({ ok: true });
});

// Baixa por venda (idempotência a cargo do chamador ou usando refId único)
stockRouter.post("/out", allowRoles("ADMIN","ATTENDANT"), async (req, res) => {
  const body = outSchema.parse(req.body);
  await stockOut({ tenantId: req.user!.tenantId, userId: req.user!.userId, ...body });
  res.json({ ok: true });
});

// Ajuste (requer PIN supervisor e ADMIN)
stockRouter.post("/adjust", allowRoles("ADMIN"), async (req, res) => {
  const body = adjSchema.parse(req.body);
  // opcional: exigir PIN no header x-supervisor-pin e validar
  await stockAdjust({ tenantId: req.user!.tenantId, userId: req.user!.userId, ...body });
  res.json({ ok: true });
});

// Listar saldos de estoque
// GET /stock?productId=...&locationId=...
stockRouter.get("/", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const data = await listStock(req.user!.tenantId, query.productId, query.locationId);
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
stockRouter.get("/movements", allowRoles("ADMIN"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const data = await listStockMovements(req.user!.tenantId, query.productId, query.locationId);
  res.json({
    items: data.map((m) => ({
      ...m,
      quantity: m.quantity, // aqui já é number no seu service (se vier como number), ajuste se for Decimal
    })),
  });
});

// Consultar nível de estoque (saldo atual) para um produto/local
// GET /stock/level?productId=...&locationId=...
stockRouter.get("/level", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const query = levelQuerySchema.parse(req.query);
  const qty = await getStockLevel(req.user!.tenantId, query.productId, query.locationId);
  res.json({ quantity: qty.toString() });
});

// Inicializar um inventário (cria se não existir com quantidade 0)
// POST /stock/init  { productId, locationId }
stockRouter.post("/init", allowRoles("ADMIN"), async (req, res) => {
  const body = initBodySchema.parse(req.body);
  const row = await initializeInventory(req.user!.tenantId, body.productId, body.locationId);
  res.status(201).json({ id: row.id, quantity: row.quantity.toString() });
});

// Inicializar em lote
// POST /stock/init/bulk  { items: [{ productId, locationId }, ...] }
stockRouter.post("/init/bulk", allowRoles("ADMIN"), async (req, res) => {
  const body = initBulkBodySchema.parse(req.body);
  const results = await Promise.all(
    body.items.map((it) => initializeInventory(req.user!.tenantId, it.productId, it.locationId))
  );
  res.status(201).json({
    items: results.map((r) => ({ id: r.id, productId: r.productId, locationId: r.locationId, quantity: r.quantity.toString() })),
  });
});

export default stockRouter;
