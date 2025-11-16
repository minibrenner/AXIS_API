-- Create enums for discount tracking and fiscal queue
CREATE TYPE "DiscountMode" AS ENUM ('NONE', 'VALUE', 'PERCENT');
CREATE TYPE "FiscalStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- Extend Sale with the discount mode flag
ALTER TABLE "Sale"
  ADD COLUMN "discountMode" "DiscountMode" NOT NULL DEFAULT 'NONE';

-- Extend SaleItem with per-item discount bookkeeping
ALTER TABLE "SaleItem"
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountMode" "DiscountMode" NOT NULL DEFAULT 'NONE';

-- Queue/table to control fiscal emissions and retries
CREATE TABLE "FiscalDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" "FiscalStatus" NOT NULL DEFAULT 'PENDING',
  "fiscalKey" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FiscalDocument_saleId_key" UNIQUE ("saleId")
);

CREATE INDEX "FiscalDocument_tenantId_status_idx" ON "FiscalDocument" ("tenantId", "status");
