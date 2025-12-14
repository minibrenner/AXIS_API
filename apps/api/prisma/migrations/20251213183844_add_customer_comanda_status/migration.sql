-- CreateEnum
CREATE TYPE "CustomerComandaStatus" AS ENUM ('ATIVO', 'DESATIVADO');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "comandaStatus" "CustomerComandaStatus" NOT NULL DEFAULT 'ATIVO';
