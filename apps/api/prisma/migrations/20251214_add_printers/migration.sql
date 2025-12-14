-- CreateEnum
CREATE TYPE "PrinterDeviceType" AS ENUM ('NETWORK', 'USB', 'WINDOWS');

-- CreateEnum
CREATE TYPE "PrinterInterface" AS ENUM ('TCP', 'USB', 'WINDOWS_DRIVER');

-- AlterEnum
BEGIN;
CREATE TYPE "PrintJobStatus_new" AS ENUM ('PENDING', 'SENDING', 'DONE', 'FAILED');
ALTER TABLE "public"."PrintJob" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PrintJob" ALTER COLUMN "status" TYPE "PrintJobStatus_new" USING ("status"::text::"PrintJobStatus_new");
ALTER TYPE "PrintJobStatus" RENAME TO "PrintJobStatus_old";
ALTER TYPE "PrintJobStatus_new" RENAME TO "PrintJobStatus";
DROP TYPE "public"."PrintJobStatus_old";
ALTER TABLE "PrintJob" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrintJobType" ADD VALUE 'KITCHEN_ORDER';
ALTER TYPE "PrintJobType" ADD VALUE 'BAR_ORDER';
ALTER TYPE "PrintJobType" ADD VALUE 'TEST_PRINT';

-- AlterTable
ALTER TABLE "Comanda" ADD COLUMN     "receiptPrinterLocationId" TEXT;

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "printerDeviceId" TEXT,
ADD COLUMN     "retries" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "printerLocationId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "receiptPrinterLocationId" TEXT;

-- CreateTable
CREATE TABLE "PrinterLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isReceiptDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrinterDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrinterDeviceType" NOT NULL,
    "interface" "PrinterInterface" NOT NULL,
    "host" TEXT,
    "port" INTEGER,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrinterLocation_tenantId_isReceiptDefault_idx" ON "PrinterLocation"("tenantId", "isReceiptDefault");

-- CreateIndex
CREATE UNIQUE INDEX "PrinterLocation_tenantId_name_key" ON "PrinterLocation"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PrinterDevice_tenantId_locationId_idx" ON "PrinterDevice"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "PrinterDevice_tenantId_isActive_idx" ON "PrinterDevice"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Comanda_tenantId_receiptPrinterLocationId_idx" ON "Comanda"("tenantId", "receiptPrinterLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_idempotencyKey_key" ON "PrintJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PrintJob_tenantId_locationId_idx" ON "PrintJob"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "Product_tenantId_printerLocationId_idx" ON "Product"("tenantId", "printerLocationId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_printerLocationId_fkey" FOREIGN KEY ("printerLocationId") REFERENCES "PrinterLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_receiptPrinterLocationId_fkey" FOREIGN KEY ("receiptPrinterLocationId") REFERENCES "PrinterLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrinterLocation" ADD CONSTRAINT "PrinterLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrinterDevice" ADD CONSTRAINT "PrinterDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrinterDevice" ADD CONSTRAINT "PrinterDevice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PrinterLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PrinterLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printerDeviceId_fkey" FOREIGN KEY ("printerDeviceId") REFERENCES "PrinterDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_receiptPrinterLocationId_fkey" FOREIGN KEY ("receiptPrinterLocationId") REFERENCES "PrinterLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

