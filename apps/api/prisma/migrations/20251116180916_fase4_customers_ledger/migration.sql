-- CreateEnum
CREATE TYPE "ProcessedSaleStatus" AS ENUM ('PENDING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('SALE_RECEIPT', 'CASH_CLOSING');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PRINTING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "CashApprovalMethod" AS ENUM ('PIN', 'PASSWORD');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('CHARGE', 'PAYMENT', 'ADJUST');

-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "closingApprovalVia" "CashApprovalMethod",
ADD COLUMN     "closingNotes" TEXT,
ADD COLUMN     "closingSnapshot" JSONB,
ADD COLUMN     "closingSupervisorId" TEXT,
ADD COLUMN     "closingSupervisorRole" "Role";

-- CreateTable
CREATE TABLE "CashWithdrawal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "deviceId" TEXT,
    "clientCreatedAt" TIMESTAMP(3),
    "status" "ProcessedSaleStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "PrintJobType" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "source" TEXT,
    "requestedById" TEXT,
    "deviceId" TEXT,
    "cashSessionId" TEXT,
    "saleId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "allowCredit" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(12,2),
    "defaultDueDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "saleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashWithdrawal_tenantId_cashSessionId_idx" ON "CashWithdrawal"("tenantId", "cashSessionId");

-- CreateIndex
CREATE INDEX "ProcessedSale_tenantId_status_idx" ON "ProcessedSale"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedSale_tenantId_saleId_key" ON "ProcessedSale"("tenantId", "saleId");

-- CreateIndex
CREATE INDEX "PrintJob_tenantId_status_type_idx" ON "PrintJob"("tenantId", "status", "type");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_document_key" ON "Customer"("tenantId", "document");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLedger_idempotencyKey_key" ON "CustomerLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CustomerLedger_tenantId_customerId_type_dueDate_idx" ON "CustomerLedger"("tenantId", "customerId", "type", "dueDate");

-- CreateIndex
CREATE INDEX "CustomerLedger_tenantId_createdAt_idx" ON "CustomerLedger"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "CashWithdrawal" ADD CONSTRAINT "CashWithdrawal_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
