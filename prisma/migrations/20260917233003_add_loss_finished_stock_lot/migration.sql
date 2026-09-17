-- AlterTable
ALTER TABLE "Loss" ADD COLUMN     "finishedStockLotId" TEXT;

-- CreateIndex
CREATE INDEX "Loss_finishedStockLotId_idx" ON "Loss"("finishedStockLotId");

-- AddForeignKey
ALTER TABLE "Loss" ADD CONSTRAINT "Loss_finishedStockLotId_fkey" FOREIGN KEY ("finishedStockLotId") REFERENCES "FinishedStockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
