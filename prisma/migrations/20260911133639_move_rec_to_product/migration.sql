-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_shopId_fkey";

-- DropIndex
DROP INDEX "Recipe_shopId_idx";

-- DropIndex
DROP INDEX "Recipe_shopId_name_key";

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "shopId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Recipe_productId_idx" ON "Recipe"("productId");
