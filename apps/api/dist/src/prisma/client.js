"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.basePrisma = void 0;
// apps/api/src/prisma/client.ts
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
const client_1 = require("@prisma/client");
const withTenantExtension_1 = require("./withTenantExtension");
// carrega variaveis do apps/.env antes de inicializar o Prisma
(0, dotenv_1.config)({ path: node_path_1.default.resolve(__dirname, "../../../.env") });
// cliente compartilhado do Prisma, responsavel por abrir conexoes com o banco de dados
exports.basePrisma = new client_1.PrismaClient({
    // registra logs detalhados somente em desenvolvimento para facilitar o debug das queries
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
// instancia tipada que acopla o middleware multi-tenant ao ciclo de vida das queries
exports.prisma = exports.basePrisma.$extends((0, withTenantExtension_1.withTenantExtension)());
//# sourceMappingURL=client.js.map