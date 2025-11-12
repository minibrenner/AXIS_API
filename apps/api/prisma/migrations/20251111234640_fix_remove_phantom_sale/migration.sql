/*
  Warnings:

  - The `status` column on the `ProcessedSale` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[id,tenantId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,tenantId]` on the table `StockLocation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'DONE', 'ERROR');

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "minQuantity" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "ProcessedSale" DROP COLUMN "status",
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "afterQuantity" TEXT,
ADD COLUMN     "beforeQuantity" TEXT,
ADD COLUMN     "oversell" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_tenantId_key" ON "Product"("id", "tenantId");

-- CreateIndex
CREATE INDEX "StockLocation_tenantId_idx" ON "StockLocation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_id_tenantId_key" ON "StockLocation"("id", "tenantId");

-- CreateIndex
CREATE INDEX "idx_sm_tenant_type_created_product" ON "StockMovement"("tenantId", "type", "createdAt", "productId");

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
