-- ======================================================
-- 1. Ajouter productId à Recipe
-- ======================================================

ALTER TABLE "Recipe"
ADD COLUMN "productId" TEXT;


-- ======================================================
-- 2. Transférer les relations existantes
--
-- Ancien :
-- Product.recipeId -> Recipe.id
--
-- Nouveau :
-- Recipe.productId -> Product.id
-- ======================================================

UPDATE "Recipe" r
SET "productId" = p."id"
FROM "Product" p
WHERE p."recipeId" = r."id";


-- ======================================================
-- 3. Vérifier qu'une recette ne possède pas plusieurs
--    produits
-- ======================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Recipe"
    WHERE "productId" IS NOT NULL
    GROUP BY "productId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Une recette est associée à plusieurs produits.';
  END IF;
END $$;


-- ======================================================
-- 4. Rendre productId obligatoire
-- ======================================================

ALTER TABLE "Recipe"
ALTER COLUMN "productId" SET NOT NULL;


-- ======================================================
-- 5. Un produit ne peut avoir qu'une seule recette
-- ======================================================

CREATE UNIQUE INDEX "Recipe_productId_key"
ON "Recipe"("productId");


-- ======================================================
-- 6. Supprimer l'ancienne FK Product -> Recipe
-- ======================================================

ALTER TABLE "Product"
DROP CONSTRAINT IF EXISTS "Product_recipeId_fkey";


-- ======================================================
-- 7. Supprimer l'ancien champ
-- ======================================================

ALTER TABLE "Product"
DROP COLUMN "recipeId";


-- ======================================================
-- 8. Ajouter la nouvelle FK Recipe -> Product
-- ======================================================

ALTER TABLE "Recipe"
ADD CONSTRAINT "Recipe_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "Product"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;