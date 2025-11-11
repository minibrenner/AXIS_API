"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockIn = stockIn;
exports.stockOut = stockOut;
exports.stockAdjust = stockAdjust;
exports.listStock = listStock;
exports.listStockMovements = listStockMovements;
exports.getStockLevel = getStockLevel;
exports.initializeInventory = initializeInventory;
// apps/api/src/stock/service.ts
const client_1 = require("@prisma/client");
const client_2 = require("../prisma/client");
async function stockIn({ tenantId, productId, locationId, qty, reason, userId }) {
    return client_2.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`, tenantId, productId, locationId);
        const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
        if (!inv)
            throw new Error("Inventário inexistente");
        const newQty = new client_1.Prisma.Decimal(inv.quantity).plus(qty);
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
        await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "IN", quantity: qty, reason, createdBy: userId } });
    });
}
async function stockOut({ tenantId, productId, locationId, qty, reason, userId, saleId }) {
    return client_2.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`, tenantId, productId, locationId);
        const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
        if (!inv)
            throw new Error("Inventário inexistente");
        const newQty = new client_1.Prisma.Decimal(inv.quantity).minus(qty);
        if (newQty.isNegative())
            throw new Error("Estoque insuficiente");
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
        await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "OUT", quantity: qty, reason, refId: saleId, createdBy: userId } });
    });
}
async function stockAdjust({ tenantId, productId, locationId, qty, reason, userId }) {
    return client_2.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`, tenantId, productId, locationId);
        const inv = await tx.inventory.findUnique({ where: { tenantId_productId_locationId: { tenantId, productId, locationId } } });
        if (!inv)
            throw new Error("Inventário inexistente");
        const newQty = new client_1.Prisma.Decimal(inv.quantity).plus(qty); // qty pode ser + ou -
        if (newQty.isNegative())
            throw new Error("Estoque ficaria negativo");
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
        await tx.stockMovement.create({ data: { tenantId, productId, locationId, type: "ADJUST", quantity: qty, reason, createdBy: userId } });
    });
}
async function listStock(tenantId, productId, locationId) {
    return client_2.prisma.inventory.findMany({
        where: {
            tenantId,
            productId,
            locationId,
        },
        orderBy: { productId: "asc" },
    });
}
async function listStockMovements(tenantId, productId, locationId) {
    return client_2.prisma.stockMovement.findMany({
        where: {
            tenantId,
            productId,
            locationId,
        },
        orderBy: { createdAt: "desc" },
    });
}
async function getStockLevel(tenantId, productId, locationId) {
    const inv = await client_2.prisma.inventory.findUnique({
        where: { tenantId_productId_locationId: { tenantId, productId, locationId } },
    });
    return inv ? inv.quantity : new client_1.Prisma.Decimal(0);
}
async function initializeInventory(tenantId, productId, locationId) {
    return client_2.prisma.inventory.upsert({
        where: { tenantId_productId_locationId: { tenantId, productId, locationId } },
        create: { tenantId, productId, locationId, quantity: new client_1.Prisma.Decimal(0) },
        update: {},
    });
}
//# sourceMappingURL=service.js.map