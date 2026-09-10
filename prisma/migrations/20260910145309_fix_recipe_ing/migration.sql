-- AlterTable
ALTER TABLE "Recipe"
ADD COLUMN "productionVolumeMl" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable
ALTER TABLE "RecipeItem"
ADD COLUMN "quantity" DECIMAL(14,3);

-- Copier les anciennes quantités
UPDATE "RecipeItem"
SET "quantity" = "quantityPerLiter";

-- La nouvelle colonne devient obligatoire
ALTER TABLE "RecipeItem"
ALTER COLUMN "quantity" SET NOT NULL;

-- Supprimer l'ancien nom maintenant que les données sont copiées
ALTER TABLE "RecipeItem"
DROP COLUMN "quantityPerLiter";