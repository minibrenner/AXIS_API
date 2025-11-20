-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "registerNumber" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "maxOpenCashSessions" INTEGER NOT NULL DEFAULT 1;
