-- AlterTable
ALTER TABLE "PrinterDevice" ADD COLUMN     "workstationId" TEXT;

-- CreateIndex
CREATE INDEX "PrinterDevice_tenantId_workstationId_idx" ON "PrinterDevice"("tenantId", "workstationId");

