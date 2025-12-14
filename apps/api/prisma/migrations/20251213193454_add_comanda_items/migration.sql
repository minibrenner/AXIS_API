-- AlterTable
ALTER TABLE "Comanda" ADD COLUMN     "tableNumber" TEXT;

-- CreateTable
CREATE TABLE "ComandaItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "tableNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComandaItem_tenantId_comandaId_idx" ON "ComandaItem"("tenantId", "comandaId");

-- CreateIndex
CREATE INDEX "ComandaItem_tenantId_productId_idx" ON "ComandaItem"("tenantId", "productId");

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
