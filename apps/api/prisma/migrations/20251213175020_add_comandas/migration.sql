-- CreateEnum
CREATE TYPE "ComandaStatus" AS ENUM ('ABERTO', 'PENDENTE', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ComandaCustomerStatus" AS ENUM ('ATIVO', 'DESATIVADO');

-- CreateTable
CREATE TABLE "Comanda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerCpf" TEXT,
    "customerStatus" "ComandaCustomerStatus" NOT NULL DEFAULT 'ATIVO',
    "status" "ComandaStatus" NOT NULL DEFAULT 'ABERTO',
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comanda_tenantId_status_idx" ON "Comanda"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Comanda_tenantId_customerStatus_idx" ON "Comanda"("tenantId", "customerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Comanda_tenantId_number_key" ON "Comanda"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
