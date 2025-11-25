// apps/api/src/stock/service.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function lockInventory(tx: TxClient, tenantId: string, productId: string, locationId: string) {
  await tx.$executeRawUnsafe(
    `SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`,
    tenantId,
    productId,
    locationId,
  );

  const inv = await tx.inventory.findUnique({
    where: { tenantId_productId_locationId: { tenantId, productId, locationId } },
  });

  if (!inv) {
    throw new Error("Inventario inexistente");
  }

  return inv;
}

type StockOperationResult = {
  inventoryId: string;
  productId: string;
  locationId: string;
  quantity: Prisma.Decimal;
  wentNegative: boolean;
};

type StockMovementBase = {
  tenantId: string;
  productId: string;
  locationId: string;
  qty: number;
  reason?: string;
  userId?: string;
};

type StockOutInput = StockMovementBase & {
  saleId?: string;
};

export type SaleInventorySelection = {
  inventoryId: string;
  productId: string;
  locationId: string;
  quantity: Prisma.Decimal;
  isSaleSource: boolean;
};

type StockTransferInput = {
  tenantId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  reason?: string;
  userId?: string;
};

type StockTransferResult = {
  from: StockOperationResult;
  to: StockOperationResult;
};

const toResult = (inv: { id: string; productId: string; locationId: string }, quantity: Prisma.Decimal) => ({
  inventoryId: inv.id,
  productId: inv.productId,
  locationId: inv.locationId,
  quantity,
  wentNegative: quantity.isNegative(),
});

async function stockInTx(
  tx: TxClient,
  { tenantId, productId, locationId, qty, reason, userId }: StockMovementBase,
): Promise<StockOperationResult> {
  const inv = await lockInventory(tx, tenantId, productId, locationId);
  const newQty = new Prisma.Decimal(inv.quantity).plus(qty);

  await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
  await tx.stockMovement.create({
    data: { tenantId, productId, locationId, type: "IN", quantity: qty, reason, createdBy: userId },
  });

  return toResult(inv, newQty);
}

async function stockOutTx(
  tx: TxClient,
  { tenantId, productId, locationId, qty, reason, userId, saleId }: StockOutInput,
): Promise<StockOperationResult> {
  const inv = await lockInventory(tx, tenantId, productId, locationId);
  const newQty = new Prisma.Decimal(inv.quantity).minus(qty);

  await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
  await tx.stockMovement.create({
    data: { tenantId, productId, locationId, type: "OUT", quantity: qty, reason, refId: saleId, createdBy: userId },
  });

  return toResult(inv, newQty);
}

export async function stockIn(params: StockMovementBase): Promise<StockOperationResult> {
  return prisma.$transaction((tx) => stockInTx(tx, params));
}

export async function stockOut(params: StockOutInput): Promise<StockOperationResult> {
  return prisma.$transaction((tx) => stockOutTx(tx, params));
}

export async function stockAdjust({
  tenantId,
  productId,
  locationId,
  qty,
  reason,
  userId,
}: StockMovementBase): Promise<StockOperationResult> {
  return prisma.$transaction(async (tx) => {
    const inv = await lockInventory(tx, tenantId, productId, locationId);
    const newQty = new Prisma.Decimal(inv.quantity).plus(qty);
    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
    await tx.stockMovement.create({
      data: { tenantId, productId, locationId, type: "ADJUST", quantity: qty, reason, createdBy: userId },
    });

    return toResult(inv, newQty);
  });
}

export async function listStock(tenantId: string, productId?: string, locationId?: string) {
  return prisma.inventory.findMany({
    where: {
      tenantId,
      productId,
      locationId,
    },
    orderBy: { productId: "asc" },
  });
}

export async function listStockMovements(tenantId: string, productId?: string, locationId?: string) {
  return prisma.stockMovement.findMany({
    where: {
      tenantId,
      productId,
      locationId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStockLevel(tenantId: string, productId: string, locationId: string) {
  const inv = await prisma.inventory.findUnique({
    where: { tenantId_productId_locationId: { tenantId, productId, locationId } },
  });
  return inv ? inv.quantity : new Prisma.Decimal(0);
}

export async function initializeInventory(tenantId: string, productId: string, locationId: string) {
  return prisma.inventory.upsert({
    where: { tenantId_productId_locationId: { tenantId, productId, locationId } },
    create: { tenantId, productId, locationId, quantity: new Prisma.Decimal(0) },
    update: {},
  });
}

export async function selectInventoryForSale(
  tenantId: string,
  productId: string,
  preferredLocationId?: string,
): Promise<SaleInventorySelection | null> {
  const zero = new Prisma.Decimal(0);

  const attempts: Array<{
    where: Prisma.InventoryWhereInput;
    orderBy?: Prisma.InventoryOrderByWithRelationInput;
  }> = [
    { where: { tenantId, productId, location: { isSaleSource: true }, quantity: { gt: zero } }, orderBy: { quantity: "desc" } },
    { where: { tenantId, productId, location: { isSaleSource: true } }, orderBy: { updatedAt: "desc" } },
    preferredLocationId
      ? { where: { tenantId, productId, locationId: preferredLocationId } }
      : null,
    { where: { tenantId, productId, quantity: { gt: zero } }, orderBy: { quantity: "desc" } },
    { where: { tenantId, productId }, orderBy: { updatedAt: "desc" } },
  ].filter(Boolean) as Array<{
    where: Prisma.InventoryWhereInput;
    orderBy?: Prisma.InventoryOrderByWithRelationInput;
  }>;

  for (const attempt of attempts) {
    const inv = await prisma.inventory.findFirst({
      where: attempt.where,
      orderBy: attempt.orderBy,
      include: { location: true },
    });

    if (inv) {
      return {
        inventoryId: inv.id,
        productId: inv.productId,
        locationId: inv.locationId,
        quantity: inv.quantity,
        isSaleSource: Boolean(inv.location?.isSaleSource),
      };
    }
  }

  return null;
}

export async function cancelSale({ tenantId, saleId, userId }: { tenantId: string; saleId: string; userId?: string }) {
  const outs = await prisma.stockMovement.findMany({
    where: { tenantId, refId: saleId, type: "OUT" },
  });

  if (outs.length === 0) {
    return { ok: true, nothing: true };
  }

  return prisma.$transaction(async (tx) => {
    for (const movement of outs) {
      const inv = await lockInventory(tx, tenantId, movement.productId, movement.locationId);
      const newQty = new Prisma.Decimal(inv.quantity).plus(movement.quantity);

      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: newQty },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: movement.productId,
          locationId: movement.locationId,
          type: "CANCEL",
          quantity: movement.quantity,
          refId: saleId,
          reason: "Cancelamento",
          createdBy: userId,
        },
      });
    }

    return { ok: true };
  });
}

export async function stockTransfer({
  tenantId,
  productId,
  fromLocationId,
  toLocationId,
  qty,
  reason,
  userId,
}: StockTransferInput): Promise<StockTransferResult> {
  if (fromLocationId === toLocationId) {
    throw new Error("Origem e destino devem ser diferentes");
  }

  const transferReason = reason ?? "Transferencia";

  return prisma.$transaction(async (tx) => {
    const from = await stockOutTx(tx, {
      tenantId,
      productId,
      locationId: fromLocationId,
      qty,
      reason: transferReason,
      userId,
    });

    const to = await stockInTx(tx, {
      tenantId,
      productId,
      locationId: toLocationId,
      qty,
      reason: transferReason,
      userId,
    });

    return { from, to };
  });
}
