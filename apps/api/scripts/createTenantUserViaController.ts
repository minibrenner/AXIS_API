import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { createUser } from "../src/modules/tenant/controllers/users.controller";
import { TenantContext } from "../src/tenancy/tenant.context";
import { prisma } from "../src/prisma/client";

type CapturedResponse = {
  statusCode: number;
  payload: unknown;
};

function createMockResponse(captured: CapturedResponse): Response {
  return {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(data: unknown) {
      captured.payload = data;
      return this;
    },
    send(data: unknown) {
      captured.payload = data;
      return this;
    },
  } as Response;
}

async function main() {
  const tenantId = process.argv[2]?.trim();

  if (!tenantId) {
    throw new Error("Informe o tenantId como primeiro argumento.");
  }

  const suffix = randomBytes(3).toString("hex");
  const requestBody = {
    email: `bootstrap-admin+${suffix}@axis.test`,
    password: "AdmBootstrap#123",
    name: `Bootstrap Admin ${suffix}`,
    role: "OWNER",
    isActive: true,
    mustChangePassword: false,
  };

  const req = {
    tenantId,
    body: requestBody,
    isBootstrapOwnerCreation: true,
  } as Request;

  const captured: CapturedResponse = { statusCode: 200, payload: null };
  const res = createMockResponse(captured);

  await TenantContext.run(tenantId, async () => {
    await createUser(req, res);
  });

  console.log(
    JSON.stringify(
      {
        status: captured.statusCode,
        data: captured.payload,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Falha ao criar admin via controller:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
