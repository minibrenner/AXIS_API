// apps/api/prisma/seed.ts
// Seed dedicado para preparar um tenant exclusivo de testes end-to-end.
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "tenant_qa_e2e";
const TENANT_NAME = "QA Test Tenant";
const TENANT_EMAIL = "qa-tenant@axis.local";

const ADMIN_ID = "tenant_qa_admin";
const ADMIN_EMAIL = "admin.qa@axis.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Axis#123";

const LOCATION_ID = "tenant_qa_location_1";
const LOCATION_NAME = "Depósito QA";

async function main() {
  // Garante tenant fixo para que os testes possam reaproveitar IDs.
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {
      name: TENANT_NAME,
      email: TENANT_EMAIL,
      isActive: true,
    },
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      email: TENANT_EMAIL,
      cnpj: "00000000000000",
      cpfResLoja: "00000000000",
      isActive: true,
    },
  });

  // Limpamos dados voláteis (categorias/produtos/estoque) do tenant de testes para cada rodada.
  await prisma.$transaction([
    prisma.stockMovement.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.inventory.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.product.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.category.deleteMany({ where: { tenantId: tenant.id } }),
  ]);

  const passwordHash = await argon2.hash(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {
      tenantId: tenant.id,
      email: ADMIN_EMAIL,
      name: "QA Admin",
      passwordHash,
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      id: ADMIN_ID,
      tenantId: tenant.id,
      email: ADMIN_EMAIL,
      name: "QA Admin",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  const location = await prisma.stockLocation.upsert({
    where: { id: LOCATION_ID },
    update: {
      tenantId: tenant.id,
      name: LOCATION_NAME,
    },
    create: {
      id: LOCATION_ID,
      tenantId: tenant.id,
      name: LOCATION_NAME,
    },
  });

  console.log("Seed pronto para os testes!");
  console.table([
    { label: "Tenant ID", value: tenant.id },
    { label: "Admin email", value: admin.email },
    { label: "Admin password", value: ADMIN_PASSWORD },
    { label: "Stock location ID", value: location.id },
  ]);
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

