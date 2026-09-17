/*
  Warnings:

  - A unique constraint covering the columns `[shopId,pointOfSaleId,variantId]` on the table `FinishedStock` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FinishedStock_shopId_pointOfSaleId_variantId_key" ON "FinishedStock"("shopId", "pointOfSaleId", "variantId");
