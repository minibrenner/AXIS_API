// apps/api/src/prisma/client.ts
import { PrismaClient } from "@prisma/client";
import { withTenantExtension } from "./withTenantExtension";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// cast só para satisfazer o TS no editor
(prisma as unknown as { $use: (mw: any) => void }).$use(withTenantExtension());
