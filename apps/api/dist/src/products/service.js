"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProducts = listProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.softDeleteProduct = softDeleteProduct;
exports.getProduct = getProduct;
// apps/api/src/products/service.ts
const client_1 = require("../prisma/client");
async function listProducts(tenantId, q) {
    return client_1.prisma.product.findMany({
        where: {
            tenantId,
            isActive: true,
            OR: q
                ? [
                    { name: { contains: q, mode: "insensitive" } },
                    { barcode: { equals: q } },
                    { sku: { equals: q } },
                ]
                : undefined,
        },
        orderBy: { name: "asc" },
        take: 100,
    });
}
async function createProduct(tenantId, data) {
    const price = String(data.price).replace(",", ".");
    const cost = data.cost ? String(data.cost).replace(",", ".") : undefined;
    const minStock = data.minStock ? String(data.minStock).replace(",", ".") : undefined;
    return client_1.prisma.product.create({
        data: {
            tenantId,
            name: data.name,
            sku: data.sku ?? "",
            barcode: data.barcode,
            unit: data.unit,
            price,
            cost,
            minStock,
            categoryId: data.categoryId,
            ncm: data.ncm,
            cest: data.cest,
            csosn: data.csosn,
            cfop: data.cfop,
            isActive: data.isActive ?? undefined,
            imagePath: data.imagePath,
        },
    });
}
async function updateProduct(tenantId, id, data) {
    const price = data.price ? String(data.price).replace(",", ".") : undefined;
    const cost = data.cost ? String(data.cost).replace(",", ".") : undefined;
    const minStock = data.minStock ? String(data.minStock).replace(",", ".") : undefined;
    return client_1.prisma.product.update({
        where: { id, tenantId },
        data: {
            ...data,
            price,
            cost,
            minStock,
            imagePath: data.imagePath,
        },
    });
}
async function softDeleteProduct(tenantId, id) {
    return client_1.prisma.product.update({ where: { id, tenantId }, data: { isActive: false } });
}
async function getProduct(tenantId, id) {
    return client_1.prisma.product.findFirst({ where: { id, tenantId } });
}
//# sourceMappingURL=service.js.map