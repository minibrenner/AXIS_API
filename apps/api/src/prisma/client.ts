// apps/api/src/prisma/client.ts
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { withTenantExtension } from "./withTenantExtension";

// carrega variaveis do apps/.env antes de inicializar o Prisma
config({ path: path.resolve(__dirname, "../../../.env") });

// cliente compartilhado do Prisma, responsavel por abrir conexoes com o banco de dados
const basePrisma = new PrismaClient({
  // registra logs detalhados somente em desenvolvimento para facilitar o debug das queries
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// instancia tipada que acopla o middleware multi-tenant ao ciclo de vida das queries
export const prisma = basePrisma.$extends(withTenantExtension());
