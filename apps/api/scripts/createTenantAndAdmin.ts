import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../src/prisma/client";
import { TenantContext } from "../src/tenancy/tenant.context";
import { issueTokens } from "../src/auth/auth.service";

const DEFAULT_LOCATION_NAME = "Deposito Principal";

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

async function main() {
  const suffix = randomBytes(3).toString("hex");

  const tenantName = `Tenant QA ${suffix}`;
  const tenantEmail = `tenant+${suffix}@axis.local`;
  const adminEmail = `admin+${suffix}@axis.local`;
  const adminPassword = `Axis#${suffix}`;
  const cnpj = randomDigits(14);
  const cpf = randomDigits(11);

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      email: tenantEmail,
      cnpj,
      cpfResLoja: cpf,
    },
  });

  const defaultLocation = await TenantContext.run(tenant.id, () =>
    prisma.stockLocation.create({
      data: {
        tenantId: tenant.id,
        name: DEFAULT_LOCATION_NAME,
      },
    })
  );

  const passwordHash = await argon2.hash(adminPassword);

  const adminUser = await TenantContext.run(tenant.id, async () =>
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        name: `QA Admin ${suffix}`,
        role: "ADMIN",
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
      },
    })
  );

  const tokens = await TenantContext.run(tenant.id, async () =>
    issueTokens(
      { id: adminUser.id, tenantId: tenant.id, role: adminUser.role },
      "script:createTenantAndAdmin",
      "127.0.0.1"
    )
  );

  return {
    tenant,
    location: defaultLocation,
    admin: adminUser,
    adminPassword,
    tokens,
  };
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error("Falha ao criar tenant/admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
