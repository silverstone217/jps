/*
  Warnings:

  - You are about to drop the column `productVariantId` on the `FinishedStockLot` table. All the data in the column will be lost.
  - You are about to drop the column `productionItemId` on the `FinishedStockLot` table. All the data in the column will be lost.
  - Added the required column `entryId` to the `FinishedStockLot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remainingQuantity` to the `FinishedStockLot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FinishedStockEntryOrigin" AS ENUM ('PRODUCTION', 'ACHAT', 'RECUPERATION', 'AJUSTEMENT');

-- DropForeignKey
ALTER TABLE "FinishedStockLot" DROP CONSTRAINT "FinishedStockLot_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "FinishedStockLot" DROP CONSTRAINT "FinishedStockLot_productionItemId_fkey";

-- DropIndex
DROP INDEX "FinishedStockLot_finishedStockId_productionItemId_key";

-- DropIndex
DROP INDEX "FinishedStockLot_productionItemId_idx";

-- AlterTable
ALTER TABLE "FinishedStockLot" DROP COLUMN "productVariantId",
DROP COLUMN "productionItemId",
ADD COLUMN     "entryId" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "remainingQuantity" INTEGER NOT NULL,
ALTER COLUMN "quantity" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FinishedStockEntry" (
    "id" TEXT NOT NULL,
    "finishedStockId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "origin" "FinishedStockEntryOrigin" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionItemId" TEXT,

    CONSTRAINT "FinishedStockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinishedStockEntry_finishedStockId_idx" ON "FinishedStockEntry"("finishedStockId");

-- CreateIndex
CREATE INDEX "FinishedStockEntry_origin_idx" ON "FinishedStockEntry"("origin");

-- CreateIndex
CREATE INDEX "FinishedStockEntry_createdById_idx" ON "FinishedStockEntry"("createdById");

-- CreateIndex
CREATE INDEX "FinishedStockEntry_createdAt_idx" ON "FinishedStockEntry"("createdAt");

-- CreateIndex
CREATE INDEX "FinishedStockEntry_productionItemId_idx" ON "FinishedStockEntry"("productionItemId");

-- CreateIndex
CREATE INDEX "FinishedStockLot_finishedStockId_idx" ON "FinishedStockLot"("finishedStockId");

-- CreateIndex
CREATE INDEX "FinishedStockLot_expiresAt_idx" ON "FinishedStockLot"("expiresAt");

-- AddForeignKey
ALTER TABLE "FinishedStockEntry" ADD CONSTRAINT "FinishedStockEntry_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockEntry" ADD CONSTRAINT "FinishedStockEntry_finishedStockId_fkey" FOREIGN KEY ("finishedStockId") REFERENCES "FinishedStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockEntry" ADD CONSTRAINT "FinishedStockEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockLot" ADD CONSTRAINT "FinishedStockLot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinishedStockEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
