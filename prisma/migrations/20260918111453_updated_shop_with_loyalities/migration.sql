-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "loyaltyDiscountAmount" DECIMAL(14,2) NOT NULL DEFAULT 1000,
ADD COLUMN     "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "loyaltyPointsForDiscount" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "loyaltyPurchaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 3000;
