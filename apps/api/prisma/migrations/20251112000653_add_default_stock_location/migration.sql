ALTER TABLE "Tenant" ADD COLUMN "defaultStockLocationId" TEXT;

CREATE INDEX "Tenant_defaultStockLocationId_idx" ON "Tenant"("defaultStockLocationId");
