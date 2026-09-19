/*
  Warnings:

  - Added the required column `pointOfSaleName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellerName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopName` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "pointOfSaleAddress" TEXT,
ADD COLUMN     "pointOfSaleName" TEXT NOT NULL,
ADD COLUMN     "pointOfSaleTelephone" TEXT,
ADD COLUMN     "sellerName" TEXT NOT NULL,
ADD COLUMN     "shopName" TEXT NOT NULL;
