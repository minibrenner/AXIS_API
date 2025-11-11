// apps/api/prisma/seed_fase2.ts (resumo)
import { PrismaClient, Unit } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst(); // usa o tenant do seed anterior
  if (!tenant) throw new Error("Tenant não encontrado");

  // Categorias
  const [mercearia, bebidas, higiene] = await Promise.all([
    prisma.category.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Mercearia" } }, update: {}, create: { tenantId: tenant.id, name: "Mercearia" } }),
    prisma.category.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Bebidas" } }, update: {}, create: { tenantId: tenant.id, name: "Bebidas" } }),
    prisma.category.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Higiene" } }, update: {}, create: { tenantId: tenant.id, name: "Higiene" } }),
  ]);

  // Localizações
  const [balcao, cozinha, deposito] = await Promise.all([
    prisma.stockLocation.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Balcão" } }, update: {}, create: { tenantId: tenant.id, name: "Balcão" } }),
    prisma.stockLocation.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Cozinha" }}, update: {}, create: { tenantId: tenant.id, name: "Cozinha" } }),
    prisma.stockLocation.upsert({ where: { tenantId_name: { tenantId: tenant.id, name: "Depósito" }}, update: {}, create: { tenantId: tenant.id, name: "Depósito" } }),
  ]);

  // Produtos
  const arroz = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "ARZ5KG" } },
    update: {},
    create: { tenantId: tenant.id, categoryId: mercearia.id, name: "Arroz 5kg", sku: "ARZ5KG", barcode: "7890000000012", unit: Unit.UN, price: "21.90" }
  });
  const refri = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "REF2L" } },
    update: {},
    create: { tenantId: tenant.id, categoryId: bebidas.id, name: "Refrigerante 2L", sku: "REF2L", barcode: "7890000000029", unit: Unit.LT, price: "9.99" }
  });
  const sabonete = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "SBN" } },
    update: {},
    create: { tenantId: tenant.id, categoryId: higiene.id, name: "Sabonete", sku: "SBN", unit: Unit.UN, price: "3.50" }
  });

  // Inventários iniciais (0)
  for (const p of [arroz, refri, sabonete]) {
    for (const loc of [balcao, cozinha, deposito]) {
      await prisma.inventory.upsert({
        where: { tenantId_productId_locationId: { tenantId: tenant.id, productId: p.id, locationId: loc.id } },
        update: {},
        create: { tenantId: tenant.id, productId: p.id, locationId: loc.id, quantity: "0" }
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
