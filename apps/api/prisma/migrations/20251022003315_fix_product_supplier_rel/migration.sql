/*
  Warnings:

  - A unique constraint covering the columns `[id,tenantId]` on the table `fornecedores` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "nome_produto" TEXT NOT NULL,
    "descricao" TEXT,
    "sku_interno" VARCHAR(100),
    "marca_produto" VARCHAR(30),
    "modelo" VARCHAR(30),
    "unidade_medida" VARCHAR(5),
    "codigo_barras" VARCHAR(100),
    "valor" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ncm" VARCHAR(30),
    "cfop" VARCHAR(20),
    "codigo_anvisa" VARCHAR(20),
    "codigo_produto" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "produtos_tenantId_nome_produto_idx" ON "produtos"("tenantId", "nome_produto");

-- CreateIndex
CREATE INDEX "produtos_tenantId_codigo_barras_idx" ON "produtos"("tenantId", "codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_per_tenant" ON "produtos"("tenantId", "sku_interno");

-- CreateIndex
CREATE UNIQUE INDEX "product_code_per_tenant" ON "produtos"("tenantId", "codigo_produto");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_id_tenantId_key" ON "fornecedores"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_supplierId_tenantId_fkey" FOREIGN KEY ("supplierId", "tenantId") REFERENCES "fornecedores"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
