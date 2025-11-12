CREATE UNIQUE INDEX "Tenant_defaultStockLocationId_key" ON "Tenant"("defaultStockLocationId");

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_defaultStockLocationId_fkey"
  FOREIGN KEY ("defaultStockLocationId") REFERENCES "StockLocation"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
