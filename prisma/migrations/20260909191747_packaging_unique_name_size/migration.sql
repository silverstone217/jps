/*
  Warnings:

  - A unique constraint covering the columns `[shopId,name,size]` on the table `Packaging` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Packaging_shopId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Packaging_shopId_name_size_key" ON "Packaging"("shopId", "name", "size");
