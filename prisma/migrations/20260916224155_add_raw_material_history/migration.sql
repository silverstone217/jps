-- CreateEnum
CREATE TYPE "RawMaterialHistoryType" AS ENUM ('INITIALIZATION', 'PURCHASE', 'PRODUCTION', 'LOSS', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "RawMaterialHistory" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "packagingId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "type" "RawMaterialHistoryType" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterialHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawMaterialHistory_ingredientId_createdAt_idx" ON "RawMaterialHistory"("ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "RawMaterialHistory_packagingId_createdAt_idx" ON "RawMaterialHistory"("packagingId", "createdAt");

-- CreateIndex
CREATE INDEX "RawMaterialHistory_type_createdAt_idx" ON "RawMaterialHistory"("type", "createdAt");

-- CreateIndex
CREATE INDEX "RawMaterialHistory_createdById_idx" ON "RawMaterialHistory"("createdById");

-- AddForeignKey
ALTER TABLE "RawMaterialHistory" ADD CONSTRAINT "RawMaterialHistory_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RawIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialHistory" ADD CONSTRAINT "RawMaterialHistory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialHistory" ADD CONSTRAINT "RawMaterialHistory_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialHistory" ADD CONSTRAINT "RawMaterialHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
