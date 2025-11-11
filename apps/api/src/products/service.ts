// apps/api/src/products/service.ts
import { prisma } from "../prisma/client";
import type { CreateProductInput, UpdateProductInput } from "./dto";

export async function listProducts(tenantId: string, q?: string) {
  return prisma.product.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: q ? [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { equals: q } },
        { sku: { equals: q } }
      ] : undefined
    },
    orderBy: { name: "asc" },
    take: 100
  });
}

export async function createProduct(tenantId: string, data: CreateProductInput) {
  const price = String(data.price).replace(",", ".");
  const cost = data.cost ? String(data.cost).replace(",", ".") : undefined;
  const minStock = data.minStock ? String(data.minStock).replace(",", ".") : undefined;

  return prisma.product.create({
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
    }
  });
}

export async function updateProduct(tenantId: string, id: string, data: UpdateProductInput) {
  const price = data.price ? String(data.price).replace(",", ".") : undefined;
  const cost = data.cost ? String(data.cost).replace(",", ".") : undefined;
  const minStock = data.minStock ? String(data.minStock).replace(",", ".") : undefined;

  return prisma.product.update({
    where: { id },
    data: { ...data, price, cost, minStock },
  });
}

export async function softDeleteProduct(tenantId: string, id: string) {
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function getProduct(tenantId: string, id: string) {
  return prisma.product.findFirst({ where: { id, tenantId } });
}
