// apps/api/src/prisma/client.ts
import { PrismaClient } from "@prisma/client";
import { withTenantExtension, type PrismaMiddleware } from "./withTenantExtension";

// cliente compartilhado do Prisma, responsavel por abrir conexoes com o banco de dados
export const prisma = new PrismaClient({
  // registra logs detalhados somente em desenvolvimento para facilitar o debug das queries
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// extensao do tipo PrismaClient para habilitar o registro de middlewares customizados
type PrismaClientComMiddleware = PrismaClient & {
  $use: (middleware: PrismaMiddleware) => void;
};

// instancia tipada que acopla o middleware multi-tenant ao ciclo de vida das queries
const prismaComTenant = prisma as PrismaClientComMiddleware;
prismaComTenant.$use(withTenantExtension());
