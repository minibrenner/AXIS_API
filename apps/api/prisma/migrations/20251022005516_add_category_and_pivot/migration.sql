/*
  Warnings:

  - A unique constraint covering the columns `[id,tenantId]` on the table `produtos` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_categorias" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_categorias_pkey" PRIMARY KEY ("productId","categoryId","tenantId")
);

-- CreateIndex
CREATE INDEX "categorias_tenantId_name_idx" ON "categorias"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_tenantId_name_key" ON "categorias"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_id_tenantId_key" ON "categorias"("id", "tenantId");

-- CreateIndex
CREATE INDEX "produto_categorias_tenantId_idx" ON "produto_categorias"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_id_tenantId_key" ON "produtos"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_categorias" ADD CONSTRAINT "produto_categorias_productId_tenantId_fkey" FOREIGN KEY ("productId", "tenantId") REFERENCES "produtos"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_categorias" ADD CONSTRAINT "produto_categorias_categoryId_tenantId_fkey" FOREIGN KEY ("categoryId", "tenantId") REFERENCES "categorias"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
