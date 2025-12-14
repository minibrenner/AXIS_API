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
  stockTransfer,
} from "./service";
import { prisma } from "../prisma/client";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import { TenantContext } from "../tenancy/tenant.context";
import { cacheGet, cacheInvalidatePrefix, cacheSet } from "../redis/cache";

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
  isSaleSource: z.coerce.boolean().optional(),
});

const locationParamSchema = z.object({
  locationId: z.string().cuid(),
});

const transferSchema = z
  .object({
    productId: z.string(),
    fromLocationId: z.string(),
    toLocationId: z.string(),
    qty: z.coerce.number().positive(),
    reason: z.string().optional(),
  })
  .refine((data) => data.fromLocationId !== data.toLocationId, {
    message: "Origem e destino devem ser diferentes",
    path: ["toLocationId"],
  });

const deleteInventorySchema = z.object({
  productId: z.string(),
  locationId: z.string(),
});

export const stockRouter = Router();
const cachePrefix = (tenantId: string) => `tenant:${tenantId}:stock`;

stockRouter.post("/in", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = inSchema.parse(req.body);

  const result = await TenantContext.run(tenantId, async () =>
    stockIn({ tenantId, userId: req.user!.userId, ...body }),
  );

  res.json({ ok: true, quantity: result.quantity.toString() });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.post("/out", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = outSchema.parse(req.body);

  const result = await TenantContext.run(tenantId, async () =>
    stockOut({ tenantId, userId: req.user!.userId, ...body }),
  );

  res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.post("/adjust", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = adjSchema.parse(req.body);

  const result = await TenantContext.run(tenantId, async () =>
    stockAdjust({ tenantId, userId: req.user!.userId, ...body }),
  );

  res.json({ ok: true, quantity: result.quantity.toString(), wentNegative: result.wentNegative });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.post("/transfer", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = transferSchema.parse(req.body);

  const result = await TenantContext.run(tenantId, async () =>
    stockTransfer({
      tenantId,
      userId: req.user!.userId,
      productId: body.productId,
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      qty: body.qty,
      reason: body.reason,
    }),
  );

  res.json({
    ok: true,
    from: {
      locationId: result.from.locationId,
      quantity: result.from.quantity.toString(),
      wentNegative: result.from.wentNegative,
    },
    to: {
      locationId: result.to.locationId,
      quantity: result.to.quantity.toString(),
    },
  });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.delete("/inventory", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const { productId, locationId } = deleteInventorySchema.parse(req.query);

  const deleted = await TenantContext.run(tenantId, async () =>
    prisma.inventory.deleteMany({
      where: { tenantId, productId, locationId },
    }),
  );

  if (deleted.count === 0) {
    throw new HttpError({
      status: 404,
      code: ErrorCodes.NOT_FOUND,
      message: "Inventario nao encontrado para este deposito/produto.",
    });
  }

  res.status(204).send();
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.get("/", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.tenantId!;
  const query = listQuerySchema.parse(req.query);

  const cacheKey = `${cachePrefix(tenantId)}:list:${query.productId ?? "all"}:${query.locationId ?? "all"}`;
  const cached = await cacheGet<{ items: unknown[] }>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const data = await TenantContext.run(tenantId, async () =>
    listStock(tenantId, query.productId, query.locationId),
  );

  const response = {
    items: data.map((d) => ({
      ...d,
      quantity: d.quantity.toString(),
    })),
  };

  await cacheSet(cacheKey, response, 120);
  res.json(response);
});

stockRouter.get("/movements", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const query = listQuerySchema.parse(req.query);

  const data = await TenantContext.run(tenantId, async () =>
    listStockMovements(tenantId, query.productId, query.locationId),
  );

  res.json({
    items: data.map((m) => ({
      ...m,
      quantity: m.quantity,
    })),
  });
});

stockRouter.get("/level", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.tenantId!;
  const query = levelQuerySchema.parse(req.query);

  const qty = await TenantContext.run(tenantId, async () =>
    getStockLevel(tenantId, query.productId, query.locationId),
  );

  res.json({ quantity: qty.toString() });
});

stockRouter.post("/init", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = initBodySchema.parse(req.body);

  const row = await TenantContext.run(tenantId, async () =>
    initializeInventory(tenantId, body.productId, body.locationId),
  );

  res.status(201).json({ id: row.id, quantity: row.quantity.toString() });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.post("/init/bulk", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const body = initBulkBodySchema.parse(req.body);

  const results = await TenantContext.run(tenantId, async () =>
    Promise.all(
      body.items.map((it) => initializeInventory(tenantId, it.productId, it.locationId)),
    ),
  );

  res.status(201).json({
    items: results.map((r) => ({
      id: r.id,
      productId: r.productId,
      locationId: r.locationId,
      quantity: r.quantity.toString(),
    })),
  });
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.get("/locations", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.tenantId!;

  const items = await TenantContext.run(tenantId, async () =>
    prisma.stockLocation.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  );

  res.json({ items });
});

stockRouter.post("/locations", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const { name, isSaleSource } = locationBodySchema.parse(req.body);

  try {
    const location = await TenantContext.run(tenantId, async () =>
      prisma.stockLocation.create({
        data: { tenantId, name, isSaleSource: isSaleSource ?? false },
      }),
    );
    res.status(201).json(location);
    await cacheInvalidatePrefix(cachePrefix(tenantId));
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
  const tenantId = req.tenantId!;
  const { locationId } = locationParamSchema.parse(req.params);
  const { name, isSaleSource } = locationBodySchema.parse(req.body);

  const updated = await TenantContext.run(tenantId, async () =>
    prisma.stockLocation.updateMany({
      where: { id: locationId, tenantId },
      data: { name, isSaleSource: isSaleSource ?? false },
    }),
  );

  if (updated.count === 0) {
    throw new HttpError({
      status: 404,
      code: ErrorCodes.NOT_FOUND,
      message: "Deposito nao encontrado.",
    });
  }

  const location = await TenantContext.run(tenantId, async () =>
    prisma.stockLocation.findFirst({
      where: { id: locationId, tenantId },
    }),
  );

  res.json(location);
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

stockRouter.delete("/locations/:locationId", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const tenantId = req.tenantId!;
  const { locationId } = locationParamSchema.parse(req.params);

  try {
    const removedCount = await TenantContext.run(tenantId, async () =>
      prisma.$transaction(async (tx) => {
        await tx.stockMovement.deleteMany({ where: { tenantId, locationId } });
        await tx.inventory.deleteMany({ where: { tenantId, locationId } });

        const removed = await tx.stockLocation.deleteMany({
          where: { id: locationId, tenantId },
        });

        return removed.count;
      }),
    );

    if (removedCount === 0) {
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
  await cacheInvalidatePrefix(cachePrefix(tenantId));
});

export default stockRouter;
