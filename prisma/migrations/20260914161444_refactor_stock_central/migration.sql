-- =========================================================
-- REFONTE DU STOCK CENTRAL
-- Migration : 20260914161444_refactor_stock_central
-- =========================================================


-- =========================================================
-- 1. PRODUCTION
-- =========================================================
--
-- La production n'est plus directement liée à un PDV.
-- Elle appartient au niveau de la boutique.
--
-- La table Production est actuellement vide.
-- =========================================================

ALTER TABLE "Production"
DROP CONSTRAINT "Production_pointOfSaleId_fkey";

ALTER TABLE "Production"
DROP CONSTRAINT "Production_pointOfSaleId_not_null";

DROP INDEX "Production_pointOfSaleId_idx";

ALTER TABLE "Production"
DROP COLUMN "pointOfSaleId";


-- =========================================================
-- 2. RECIPE
-- =========================================================
--
-- Recipe appartient à Product.
-- Product appartient à Shop.
--
-- Recipe.shopId est donc redondant.
-- =========================================================

ALTER TABLE "Recipe"
DROP COLUMN "shopId";


-- =========================================================
-- 3. FINISHED STOCK
-- =========================================================
--
-- Stock central :
--
-- shopId        = SHOP_ID
-- pointOfSaleId = NULL
--
-- Stock PDV :
--
-- shopId        = SHOP_ID
-- pointOfSaleId = POS_ID
--
-- =========================================================

ALTER TABLE "FinishedStock"
ADD COLUMN "shopId" TEXT;

ALTER TABLE "FinishedStock"
ALTER COLUMN "shopId" SET NOT NULL;

ALTER TABLE "FinishedStock"
ALTER COLUMN "pointOfSaleId" DROP NOT NULL;

DROP INDEX "FinishedStock_pointOfSaleId_variantId_key";


-- =========================================================
-- 4. STOCK TRANSFER
-- =========================================================
--
-- Central -> PDV :
--
-- fromPosId = NULL
-- toPosId   = POS_ID
--
-- PDV -> Central :
--
-- fromPosId = POS_ID
-- toPosId   = NULL
--
-- PDV -> PDV :
--
-- fromPosId = POS_A
-- toPosId   = POS_B
--
-- =========================================================

ALTER TABLE "StockTransfer"
DROP CONSTRAINT "StockTransfer_fromPosId_fkey";

ALTER TABLE "StockTransfer"
DROP CONSTRAINT "StockTransfer_toPosId_fkey";

ALTER TABLE "StockTransfer"
DROP CONSTRAINT "StockTransfer_fromPosId_not_null";

ALTER TABLE "StockTransfer"
DROP CONSTRAINT "StockTransfer_toPosId_not_null";

ALTER TABLE "StockTransfer"
ALTER COLUMN "fromPosId" DROP NOT NULL;

ALTER TABLE "StockTransfer"
ALTER COLUMN "toPosId" DROP NOT NULL;

ALTER TABLE "StockTransfer"
ADD COLUMN "shopId" TEXT;

ALTER TABLE "StockTransfer"
ALTER COLUMN "shopId" SET NOT NULL;


-- =========================================================
-- 5. LOSS
-- =========================================================
--
-- Chaque perte appartient à une boutique.
--
-- pointOfSaleId reste nullable :
--
-- NULL   = perte centrale
-- POS_ID = perte dans un PDV
--
-- =========================================================

ALTER TABLE "Loss"
ADD COLUMN "shopId" TEXT;

ALTER TABLE "Loss"
ALTER COLUMN "shopId" SET NOT NULL;


-- =========================================================
-- 6. FK FINISHED STOCK -> SHOP
-- =========================================================

ALTER TABLE "FinishedStock"
ADD CONSTRAINT "FinishedStock_shopId_fkey"
FOREIGN KEY ("shopId")
REFERENCES "Shop"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


-- =========================================================
-- 7. FK STOCK TRANSFER -> SHOP
-- =========================================================

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_shopId_fkey"
FOREIGN KEY ("shopId")
REFERENCES "Shop"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


-- =========================================================
-- 8. FK LOSS -> SHOP
-- =========================================================

ALTER TABLE "Loss"
ADD CONSTRAINT "Loss_shopId_fkey"
FOREIGN KEY ("shopId")
REFERENCES "Shop"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


-- =========================================================
-- 9. FK STOCK TRANSFER -> POINT OF SALE
-- =========================================================

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_fromPosId_fkey"
FOREIGN KEY ("fromPosId")
REFERENCES "PointOfSale"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_toPosId_fkey"
FOREIGN KEY ("toPosId")
REFERENCES "PointOfSale"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


-- =========================================================
-- 10. INDEX FINISHED STOCK
-- =========================================================
--
-- FinishedStock_variantId_idx existe déjà.
--
-- On ajoute seulement les nouveaux index.
-- =========================================================

CREATE INDEX "FinishedStock_shopId_idx"
ON "FinishedStock"("shopId");

CREATE INDEX "FinishedStock_pointOfSaleId_idx"
ON "FinishedStock"("pointOfSaleId");


-- =========================================================
-- 11. INDEX STOCK TRANSFER
-- =========================================================

CREATE INDEX "StockTransfer_shopId_idx"
ON "StockTransfer"("shopId");


-- =========================================================
-- 12. INDEX LOSS
-- =========================================================

CREATE INDEX "Loss_shopId_idx"
ON "Loss"("shopId");


-- =========================================================
-- 13. UNIQUE STOCK CENTRAL
-- =========================================================
--
-- Un seul stock central par variant et par boutique.
-- =========================================================

CREATE UNIQUE INDEX "FinishedStock_main_unique"
ON "FinishedStock" ("shopId", "variantId")
WHERE "pointOfSaleId" IS NULL;


-- =========================================================
-- 14. UNIQUE STOCK PDV
-- =========================================================
--
-- Un seul stock d'un variant dans un PDV.
-- =========================================================

CREATE UNIQUE INDEX "FinishedStock_pos_unique"
ON "FinishedStock" ("pointOfSaleId", "variantId")
WHERE "pointOfSaleId" IS NOT NULL;


-- =========================================================
-- 15. STOCK TRANSFER :
--     AU MOINS UNE EXTRÉMITÉ
-- =========================================================

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_at_least_one_endpoint"
CHECK (
  "fromPosId" IS NOT NULL
  OR "toPosId" IS NOT NULL
);


-- =========================================================
-- 16. STOCK TRANSFER :
--     PAS DE TRANSFERT VERS SOI-MÊME
-- =========================================================

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_different_endpoints"
CHECK (
  "fromPosId" IS NULL
  OR "toPosId" IS NULL
  OR "fromPosId" <> "toPosId"
);