/*
  Warnings:

  - The values [ADMIN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `quantity` on the `Loss` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,3)`.
  - You are about to alter the column `price` on the `ProductVariant` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `totalVolumeMl` on the `Production` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,3)`.
  - You are about to alter the column `stockQty` on the `RawIngredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,3)`.
  - You are about to alter the column `minAlert` on the `RawIngredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,3)`.
  - You are about to alter the column `quantity` on the `RawMaterialPurchase` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,3)`.
  - You are about to alter the column `unitCost` on the `RawMaterialPurchase` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `totalCost` on the `RawMaterialPurchase` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to drop the column `quantityUsed` on the `RecipeItem` table. All the data in the column will be lost.
  - You are about to alter the column `totalAmount` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `discountAmount` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `unitPrice` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `subtotal` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - A unique constraint covering the columns `[shopId,name]` on the table `Packaging` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopId,name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopId,name]` on the table `RawIngredient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopId,name]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[recipeId,ingredientId]` on the table `RecipeItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FinishedStock` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reportedById` to the `Loss` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pointOfSaleId` to the `Production` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `ProductionItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remainingQuantity` to the `ProductionItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityPerLiter` to the `RecipeItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('GENERATED', 'SENT', 'PRINTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceDeliveryMethod" AS ENUM ('WHATSAPP', 'PRINT', 'BOTH');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('MANAGER', 'EMPLOYEE');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- DropForeignKey
ALTER TABLE "FinishedStock" DROP CONSTRAINT "FinishedStock_pointOfSaleId_fkey";

-- DropForeignKey
ALTER TABLE "FinishedStock" DROP CONSTRAINT "FinishedStock_variantId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_packagingId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "Production" DROP CONSTRAINT "Production_managerId_fkey";

-- DropForeignKey
ALTER TABLE "ProductionItem" DROP CONSTRAINT "ProductionItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeItem" DROP CONSTRAINT "RecipeItem_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_pointOfSaleId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_createdById_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_fromPosId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_toPosId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransferItem" DROP CONSTRAINT "StockTransferItem_variantId_fkey";

-- DropIndex
DROP INDEX "User_telephone_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FinishedStock" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Loss" ADD COLUMN     "reportedById" TEXT NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "Packaging" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PointOfSale" ADD COLUMN     "isMainStore" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shelfLifeDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "pointOfSaleId" TEXT NOT NULL,
ALTER COLUMN "totalVolumeMl" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "ProductionItem" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "remainingQuantity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RawIngredient" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "stockQty" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "minAlert" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "RawMaterialPurchase" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "RecipeItem" DROP COLUMN "quantityUsed",
ADD COLUMN     "quantityPerLiter" DECIMAL(14,3) NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "SaleItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "FinishedStockLot" (
    "id" TEXT NOT NULL,
    "finishedStockId" TEXT NOT NULL,
    "productionItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productVariantId" TEXT,

    CONSTRAINT "FinishedStockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionIngredient" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityUsed" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ProductionIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPackaging" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,

    CONSTRAINT "ProductionPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "deliveryMethod" "InvoiceDeliveryMethod",
    "whatsappSentAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinishedStockLot_productionItemId_idx" ON "FinishedStockLot"("productionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedStockLot_finishedStockId_productionItemId_key" ON "FinishedStockLot"("finishedStockId", "productionItemId");

-- CreateIndex
CREATE INDEX "ProductionIngredient_ingredientId_idx" ON "ProductionIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionIngredient_productionId_ingredientId_key" ON "ProductionIngredient"("productionId", "ingredientId");

-- CreateIndex
CREATE INDEX "ProductionPackaging_packagingId_idx" ON "ProductionPackaging"("packagingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPackaging_productionId_packagingId_key" ON "ProductionPackaging"("productionId", "packagingId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customerId_idx" ON "LoyaltyTransaction"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_saleId_idx" ON "LoyaltyTransaction"("saleId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "FinishedStock_variantId_idx" ON "FinishedStock"("variantId");

-- CreateIndex
CREATE INDEX "Loss_pointOfSaleId_idx" ON "Loss"("pointOfSaleId");

-- CreateIndex
CREATE INDEX "Loss_reportedById_idx" ON "Loss"("reportedById");

-- CreateIndex
CREATE INDEX "Loss_reportedAt_idx" ON "Loss"("reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Packaging_shopId_name_key" ON "Packaging"("shopId", "name");

-- CreateIndex
CREATE INDEX "PointOfSale_shopId_isMainStore_idx" ON "PointOfSale"("shopId", "isMainStore");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_name_key" ON "Product"("shopId", "name");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_packagingId_idx" ON "ProductVariant"("packagingId");

-- CreateIndex
CREATE INDEX "Production_managerId_idx" ON "Production"("managerId");

-- CreateIndex
CREATE INDEX "Production_pointOfSaleId_idx" ON "Production"("pointOfSaleId");

-- CreateIndex
CREATE INDEX "Production_producedAt_idx" ON "Production"("producedAt");

-- CreateIndex
CREATE INDEX "ProductionItem_variantId_idx" ON "ProductionItem"("variantId");

-- CreateIndex
CREATE INDEX "ProductionItem_expiresAt_idx" ON "ProductionItem"("expiresAt");

-- CreateIndex
CREATE INDEX "ProductionItem_productionId_idx" ON "ProductionItem"("productionId");

-- CreateIndex
CREATE UNIQUE INDEX "RawIngredient_shopId_name_key" ON "RawIngredient"("shopId", "name");

-- CreateIndex
CREATE INDEX "RawMaterialPurchase_ingredientId_idx" ON "RawMaterialPurchase"("ingredientId");

-- CreateIndex
CREATE INDEX "RawMaterialPurchase_packagingId_idx" ON "RawMaterialPurchase"("packagingId");

-- CreateIndex
CREATE INDEX "RawMaterialPurchase_purchaseDate_idx" ON "RawMaterialPurchase"("purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_shopId_name_key" ON "Recipe"("shopId", "name");

-- CreateIndex
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_ingredientId_key" ON "RecipeItem"("recipeId", "ingredientId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_variantId_idx" ON "SaleItem"("variantId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromPosId_idx" ON "StockTransfer"("fromPosId");

-- CreateIndex
CREATE INDEX "StockTransfer_toPosId_idx" ON "StockTransfer"("toPosId");

-- CreateIndex
CREATE INDEX "StockTransfer_createdById_idx" ON "StockTransfer"("createdById");

-- CreateIndex
CREATE INDEX "StockTransfer_transferredAt_idx" ON "StockTransfer"("transferredAt");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferItem_variantId_idx" ON "StockTransferItem"("variantId");

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RawIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStock" ADD CONSTRAINT "FinishedStock_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStock" ADD CONSTRAINT "FinishedStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockLot" ADD CONSTRAINT "FinishedStockLot_finishedStockId_fkey" FOREIGN KEY ("finishedStockId") REFERENCES "FinishedStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockLot" ADD CONSTRAINT "FinishedStockLot_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedStockLot" ADD CONSTRAINT "FinishedStockLot_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIngredient" ADD CONSTRAINT "ProductionIngredient_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIngredient" ADD CONSTRAINT "ProductionIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RawIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPackaging" ADD CONSTRAINT "ProductionPackaging_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPackaging" ADD CONSTRAINT "ProductionPackaging_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromPosId_fkey" FOREIGN KEY ("fromPosId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toPosId_fkey" FOREIGN KEY ("toPosId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loss" ADD CONSTRAINT "Loss_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
