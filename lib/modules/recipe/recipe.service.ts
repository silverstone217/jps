import { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

// ======================================================
// CONFIGURATION
// ======================================================

const MAIN_SHOP_SINGLETON = "MAIN";

// ======================================================
// TYPES
// ======================================================

import type {
  CreateRecipeInput,
  RecipeData,
  UpdateRecipeInput,
} from "./recipe.schema";

// ======================================================
// SELECT
// ======================================================

const recipeSelect = {
  id: true,
  shopId: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,

  items: {
    orderBy: {
      id: "asc",
    },

    select: {
      id: true,
      recipeId: true,
      ingredientId: true,
      quantityPerLiter: true,
    },
  },
} satisfies Prisma.RecipeSelect;

// ======================================================
// SHOP
// ======================================================

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: MAIN_SHOP_SINGLETON,
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
}

// ======================================================
// MAPPING
// ======================================================

function mapRecipe(
  recipe: Prisma.RecipeGetPayload<{
    select: typeof recipeSelect;
  }>,
): RecipeData {
  return {
    id: recipe.id,
    shopId: recipe.shopId,
    name: recipe.name,
    description: recipe.description,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),

    items: recipe.items.map((item) => ({
      id: item.id,
      recipeId: item.recipeId,
      ingredientId: item.ingredientId,
      quantityPerLiter: Number(item.quantityPerLiter),
    })),
  };
}

// ======================================================
// VALIDATION DES ITEMS
// ======================================================

async function validateRecipeItems(
  shopId: string,
  items: Array<{
    ingredientId: string;
    quantityPerLiter: number;
  }>,
) {
  // --------------------------------------------------
  // Nombre maximum
  // --------------------------------------------------

  if (items.length > 50) {
    throw new Error("TOO_MANY_RECIPE_ITEMS");
  }

  // --------------------------------------------------
  // Doublons d'ingrédients
  // --------------------------------------------------

  const ingredientIds = items.map((item) => item.ingredientId);

  const uniqueIngredientIds = new Set(ingredientIds);

  if (uniqueIngredientIds.size !== ingredientIds.length) {
    throw new Error("DUPLICATE_RECIPE_INGREDIENT");
  }

  // --------------------------------------------------
  // Vérification des ingrédients
  // --------------------------------------------------

  const ingredients = await prisma.rawIngredient.findMany({
    where: {
      id: {
        in: ingredientIds,
      },
      shopId,
    },

    select: {
      id: true,
      isActive: true,
    },
  });

  const ingredientsById = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );

  for (const ingredientId of ingredientIds) {
    const ingredient = ingredientsById.get(ingredientId);

    if (!ingredient) {
      throw new Error("INGREDIENT_NOT_FOUND");
    }

    if (!ingredient.isActive) {
      throw new Error("INGREDIENT_INACTIVE");
    }
  }
}

// ======================================================
// VÉRIFICATION NOM
// ======================================================

async function ensureRecipeNameAvailable(
  shopId: string,
  name: string,
  excludedRecipeId?: string,
) {
  const recipes = await prisma.recipe.findMany({
    where: {
      shopId,

      ...(excludedRecipeId
        ? {
            id: {
              not: excludedRecipeId,
            },
          }
        : {}),
    },

    select: {
      id: true,
      name: true,
    },
  });

  const normalizedName = name.trim().toLowerCase();

  const duplicate = recipes.some(
    (recipe) => recipe.name.trim().toLowerCase() === normalizedName,
  );

  if (duplicate) {
    throw new Error("RECIPE_NAME_ALREADY_EXISTS");
  }
}

// ======================================================
// RÉCUPÉRER TOUTES LES RECETTES
// ======================================================

export async function getRecipes(): Promise<RecipeData[]> {
  const shop = await getMainShop();

  const recipes = await prisma.recipe.findMany({
    where: {
      shopId: shop.id,
    },

    orderBy: {
      name: "asc",
    },

    select: recipeSelect,
  });

  return recipes.map(mapRecipe);
}

// ======================================================
// RÉCUPÉRER UNE RECETTE
// ======================================================

export async function getRecipeById(recipeId: string): Promise<RecipeData> {
  const shop = await getMainShop();

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      shopId: shop.id,
    },

    select: recipeSelect,
  });

  if (!recipe) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  return mapRecipe(recipe);
}

// ======================================================
// CRÉER UNE RECETTE
// ======================================================

export async function createRecipe(
  input: CreateRecipeInput,
): Promise<RecipeData> {
  const shop = await getMainShop();

  // --------------------------------------------------
  // NOM
  // --------------------------------------------------

  await ensureRecipeNameAvailable(shop.id, input.name);

  // --------------------------------------------------
  // ITEMS
  // --------------------------------------------------

  await validateRecipeItems(shop.id, input.items);

  // --------------------------------------------------
  // CRÉATION
  // --------------------------------------------------

  const recipe = await prisma.$transaction(async (tx) => {
    const createdRecipe = await tx.recipe.create({
      data: {
        shopId: shop.id,

        name: input.name.trim(),

        description: input.description?.trim()
          ? input.description.trim()
          : null,

        items: {
          create: input.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantityPerLiter: new Prisma.Decimal(item.quantityPerLiter),
          })),
        },
      },

      select: recipeSelect,
    });

    return createdRecipe;
  });

  return mapRecipe(recipe);
}

// ======================================================
// MODIFIER UNE RECETTE
// ======================================================

export async function updateRecipe(
  recipeId: string,
  input: UpdateRecipeInput,
): Promise<RecipeData> {
  const shop = await getMainShop();

  // --------------------------------------------------
  // RECETTE
  // --------------------------------------------------

  const existingRecipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      shopId: shop.id,
    },

    select: {
      id: true,
      shopId: true,
      items: {
        select: {
          id: true,
          ingredientId: true,
        },
      },
    },
  });

  if (!existingRecipe) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  // --------------------------------------------------
  // NOM
  // --------------------------------------------------

  await ensureRecipeNameAvailable(shop.id, input.name, recipeId);

  // --------------------------------------------------
  // ITEMS
  // --------------------------------------------------

  await validateRecipeItems(shop.id, input.items);

  // --------------------------------------------------
  // IDS EXISTANTS
  // --------------------------------------------------

  const existingItemIds = new Set(existingRecipe.items.map((item) => item.id));

  const incomingItemIds = input.items
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));

  // --------------------------------------------------
  // VÉRIFIER QUE LES IDS APPARTIENNENT
  // À CETTE RECETTE
  // --------------------------------------------------

  for (const itemId of incomingItemIds) {
    if (!existingItemIds.has(itemId)) {
      throw new Error("RECIPE_ITEM_NOT_FOUND");
    }
  }

  // --------------------------------------------------
  // IDS À SUPPRIMER
  // --------------------------------------------------

  const incomingItemIdSet = new Set(incomingItemIds);

  const itemIdsToDelete = existingRecipe.items
    .map((item) => item.id)
    .filter((itemId) => !incomingItemIdSet.has(itemId));

  // --------------------------------------------------
  // TRANSACTION
  // --------------------------------------------------

  const recipe = await prisma.$transaction(async (tx) => {
    // ----------------------------------------------
    // SUPPRESSION DES ITEMS RETIRÉS
    // ----------------------------------------------

    if (itemIdsToDelete.length > 0) {
      await tx.recipeItem.deleteMany({
        where: {
          id: {
            in: itemIdsToDelete,
          },

          recipeId,
        },
      });
    }

    // ----------------------------------------------
    // MISE À JOUR / CRÉATION
    // ----------------------------------------------

    for (const item of input.items) {
      if (item.id) {
        await tx.recipeItem.update({
          where: {
            id: item.id,
          },

          data: {
            ingredientId: item.ingredientId,

            quantityPerLiter: new Prisma.Decimal(item.quantityPerLiter),
          },
        });
      } else {
        await tx.recipeItem.create({
          data: {
            recipeId,

            ingredientId: item.ingredientId,

            quantityPerLiter: new Prisma.Decimal(item.quantityPerLiter),
          },
        });
      }
    }

    // ----------------------------------------------
    // MISE À JOUR RECETTE
    // ----------------------------------------------

    return tx.recipe.update({
      where: {
        id: recipeId,
      },

      data: {
        name: input.name.trim(),

        description: input.description?.trim()
          ? input.description.trim()
          : null,
      },

      select: recipeSelect,
    });
  });

  return mapRecipe(recipe);
}

// ======================================================
// VÉRIFIER SI UNE RECETTE EST UTILISÉE
// ======================================================

async function recipeHasProducts(recipeId: string): Promise<boolean> {
  const count = await prisma.product.count({
    where: {
      recipeId,
    },
  });

  return count > 0;
}

// ======================================================
// SUPPRIMER UNE RECETTE
// ======================================================

export async function deleteRecipe(recipeId: string): Promise<RecipeData> {
  const shop = await getMainShop();

  // --------------------------------------------------
  // RECETTE
  // --------------------------------------------------

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      shopId: shop.id,
    },

    select: recipeSelect,
  });

  if (!recipe) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  // --------------------------------------------------
  // PRODUITS ASSOCIÉS
  // --------------------------------------------------

  const hasProducts = await recipeHasProducts(recipeId);

  if (hasProducts) {
    throw new Error("RECIPE_IN_USE");
  }

  // --------------------------------------------------
  // SUPPRESSION
  // --------------------------------------------------

  await prisma.recipe.delete({
    where: {
      id: recipeId,
    },
  });

  return mapRecipe(recipe);
}
