/*
  Warnings:

  - A unique constraint covering the columns `[cpfResLoja]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cpfResLoja" TEXT,
ADD COLUMN     "email" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "codigo_fornecedor" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "telefone" VARCHAR(16),
    "telefone_celular" VARCHAR(16),
    "email" VARCHAR(120),
    "ie" VARCHAR(20),
    "cep" VARCHAR(8),
    "city" VARCHAR(60),
    "uf" VARCHAR(2),
    "address" VARCHAR(120),
    "addressNo" VARCHAR(10),
    "complement" VARCHAR(60),
    "neighborhood" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fornecedores_tenantId_nome_fantasia_idx" ON "fornecedores"("tenantId", "nome_fantasia");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_tenantId_cnpj_key" ON "fornecedores"("tenantId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_tenantId_codigo_fornecedor_key" ON "fornecedores"("tenantId", "codigo_fornecedor");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_cpfResLoja_key" ON "Tenant"("cpfResLoja");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
