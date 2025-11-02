/*
  Warnings:

  - You are about to drop the column `mustChangePassword` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ownerUserId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "mustChangePassword",
DROP COLUMN "passwordHash",
ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_ownerUserId_key" ON "Tenant"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
