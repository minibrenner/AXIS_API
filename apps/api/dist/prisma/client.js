"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// apps/api/src/prisma/client.ts
const client_1 = require("@prisma/client");
const withTenantExtension_1 = require("./withTenantExtension");
// cliente compartilhado do Prisma, responsavel por abrir conexoes com o banco de dados
const basePrisma = new client_1.PrismaClient({
    // registra logs detalhados somente em desenvolvimento para facilitar o debug das queries
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
// instancia tipada que acopla o middleware multi-tenant ao ciclo de vida das queries
exports.prisma = basePrisma.$extends((0, withTenantExtension_1.withTenantExtension)());
//# sourceMappingURL=client.js.map