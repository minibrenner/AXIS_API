import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
import { prisma } from "../prisma/client";
import { ErrorCodes, HttpError } from "../utils/httpErrors";

const inSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  qty: z.coerce.number().positive(),
  reason: z.string().optional(),
});

const outSchema = inSchema.extend({ saleId: z.string().optional() });
const adjSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  qty: z.coerce.number(),
  reason: z.string().optional(),
});

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

const locationBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const locationParamSchema = z.object({
  locationId: z.string().cuid(),
});

export const stockRouter = Router();

stockRouter.post("/in", allowRoles("ADMIN"), async (req, res) => {
  const body = inSchema.parse(req.body);
  const result = await stockIn({ tenantId: req.tenantId!, userId: req.user!.userId, ...body });
  res.json({ ok: true, quantity: result.quantity.toString() });
});

stockRouter.post("/out", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const body = outSchema.parse(req.body);
  const result = await stockOut({ tenantId: req.tenantId!, userId: req.user!.userId, ...body });
  res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
});

stockRouter.post("/adjust", allowRoles("ADMIN"), async (req, res) => {
  const body = adjSchema.parse(req.body);
  const result = await stockAdjust({ tenantId: req.tenantId!, userId: req.user!.userId, ...body });
  res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
});

stockRouter.get("/", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const data = await listStock(req.tenantId!, query.productId, query.locationId);
  res.json({
    items: data.map((d) => ({
      ...d,
      quantity: d.quantity.toString(),
    })),
  });
});

stockRouter.get("/movements", allowRoles("ADMIN"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const data = await listStockMovements(req.tenantId!, query.productId, query.locationId);
  res.json({
    items: data.map((m) => ({
      ...m,
      quantity: m.quantity,
    })),
  });
});

stockRouter.get("/level", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const query = levelQuerySchema.parse(req.query);
  const qty = await getStockLevel(req.tenantId!, query.productId, query.locationId);
  res.json({ quantity: qty.toString() });
});

stockRouter.post("/init", allowRoles("ADMIN"), async (req, res) => {
  const body = initBodySchema.parse(req.body);
  const row = await initializeInventory(req.tenantId!, body.productId, body.locationId);
  res.status(201).json({ id: row.id, quantity: row.quantity.toString() });
});

stockRouter.post("/init/bulk", allowRoles("ADMIN"), async (req, res) => {
  const body = initBulkBodySchema.parse(req.body);
  const results = await Promise.all(
    body.items.map((it) => initializeInventory(req.tenantId!, it.productId, it.locationId))
  );
  res.status(201).json({
    items: results.map((r) => ({
      id: r.id,
      productId: r.productId,
      locationId: r.locationId,
      quantity: r.quantity.toString(),
    })),
  });
});

stockRouter.get("/locations", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const items = await prisma.stockLocation.findMany({
    where: { tenantId: req.tenantId! },
    orderBy: { name: "asc" },
  });

  res.json({ items });
});

stockRouter.post("/locations", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const { name } = locationBodySchema.parse(req.body);

  try {
    const location = await prisma.stockLocation.create({
      data: { tenantId: req.tenantId!, name },
    });
    res.status(201).json(location);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError({
        status: 409,
        code: ErrorCodes.CONFLICT,
        message: "Ja existe um deposito com esse nome.",
      });
    }
    throw error;
  }
});

stockRouter.put("/locations/:locationId", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const { locationId } = locationParamSchema.parse(req.params);
  const { name } = locationBodySchema.parse(req.body);

  const updated = await prisma.stockLocation.updateMany({
    where: { id: locationId, tenantId: req.tenantId! },
    data: { name },
  });

  if (updated.count === 0) {
    throw new HttpError({
      status: 404,
      code: ErrorCodes.NOT_FOUND,
      message: "Deposito nao encontrado.",
    });
  }

  const location = await prisma.stockLocation.findFirst({
    where: { id: locationId, tenantId: req.tenantId! },
  });

  res.json(location);
});

stockRouter.delete("/locations/:locationId", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const { locationId } = locationParamSchema.parse(req.params);

  try {
    const removed = await prisma.stockLocation.deleteMany({
      where: { id: locationId, tenantId: req.tenantId! },
    });

    if (removed.count === 0) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Deposito nao encontrado.",
      });
    }
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.CONFLICT,
        message: "Deposito vinculado a inventarios nao pode ser removido.",
      });
    }
    throw error;
  }

  res.status(204).send();
});

export default stockRouter;
