// apps/api/src/stock/service.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";



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

export async function stockIn({ tenantId, productId, locationId, qty, reason, userId }: StockMovementBase) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`,
      tenantId, productId, locationId
    );
    const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
    if (!inv) throw new Error("Inventário inexistente");
    const newQty = new Prisma.Decimal(inv.quantity).plus(qty);
    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
    await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "IN", quantity: qty, reason, createdBy: userId } });
  });
}

export async function stockOut({ tenantId, productId, locationId, qty, reason, userId, saleId }: StockOutInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`,
      tenantId, productId, locationId
    );
    const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
    if (!inv) throw new Error("Inventário inexistente");
    const newQty = new Prisma.Decimal(inv.quantity).minus(qty);
    if (newQty.isNegative()) throw new Error("Estoque insuficiente");
    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
    await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "OUT", quantity: qty, reason, refId: saleId, createdBy: userId } });
  });
}

export async function stockAdjust({ tenantId, productId, locationId, qty, reason, userId }: StockMovementBase) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`,
      tenantId, productId, locationId
    );
    const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
    if (!inv) throw new Error("Inventário inexistente");
    const newQty = new Prisma.Decimal(inv.quantity).plus(qty); // qty pode ser + ou -
    if (newQty.isNegative()) throw new Error("Estoque ficaria negativo");
    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
    await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "ADJUST", quantity: qty, reason, createdBy: userId } });
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
  const inv =  await prisma.inventory.findUnique({
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