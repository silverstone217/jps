import { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  CreateRecipeInput,
  RecipeData,
  UpdateRecipeInput,
} from "./recipe.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const MAIN_SHOP_SINGLETON = "MAIN";

// ======================================================
// SELECT
// ======================================================

const recipeSelect = {
  id: true,
  productId: true,
  name: true,
  description: true,
  productionVolumeMl: true,
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
      quantity: true,
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
    productId: recipe.productId,

    name: recipe.name,
    description: recipe.description,

    productionVolumeMl: recipe.productionVolumeMl,

    createdAt: recipe.createdAt.toISOString(),

    updatedAt: recipe.updatedAt.toISOString(),

    items: recipe.items.map((item) => ({
      id: item.id,
      recipeId: item.recipeId,
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity),
    })),
  };
}

// ======================================================
// PRODUIT
// ======================================================

async function getProductForRecipe(productId: string) {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },

    select: {
      id: true,
      shopId: true,
      name: true,
      recipe: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return product;
}

// ======================================================
// VALIDATION DES ITEMS
// ======================================================

async function validateRecipeItems(
  shopId: string,
  items: Array<{
    ingredientId: string;
    quantity: number;
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
// VÉRIFICATION DU NOM
// ======================================================
//
// Le nom de recette n'a plus besoin d'être
// unique au niveau du Shop.
//
// Chaque produit possède au maximum UNE recette.
//
// On conserve néanmoins cette fonction si tu veux
// éviter deux recettes portant exactement le même
// nom dans la boutique.
//

async function ensureRecipeNameAvailable(
  shopId: string,
  name: string,
  excludedRecipeId?: string,
) {
  const recipes = await prisma.recipe.findMany({
    where: {
      product: {
        shopId,
      },

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
      product: {
        shopId: shop.id,
      },
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

      product: {
        shopId: shop.id,
      },
    },

    select: recipeSelect,
  });

  if (!recipe) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  return mapRecipe(recipe);
}

// ======================================================
// RÉCUPÉRER LA RECETTE D'UN PRODUIT
// ======================================================

export async function getRecipeByProductId(
  productId: string,
): Promise<RecipeData | null> {
  const shop = await getMainShop();

  const recipe = await prisma.recipe.findFirst({
    where: {
      productId,

      product: {
        shopId: shop.id,
      },
    },

    select: recipeSelect,
  });

  if (!recipe) {
    return null;
  }

  return mapRecipe(recipe);
}

// ======================================================
// CRÉER UNE RECETTE
// ======================================================
//
// productId vient de la route / du contexte.
// Il ne vient pas du body.
//

export async function createRecipe(
  productId: string,
  input: CreateRecipeInput,
): Promise<RecipeData> {
  const shop = await getMainShop();

  // --------------------------------------------------
  // PRODUIT
  // --------------------------------------------------

  const product = await getProductForRecipe(productId);

  // --------------------------------------------------
  // UNE SEULE RECETTE PAR PRODUIT
  // --------------------------------------------------

  if (product.recipe) {
    throw new Error("PRODUCT_ALREADY_HAS_RECIPE");
  }

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
        productId: product.id,

        name: input.name.trim(),

        description: input.description?.trim()
          ? input.description.trim()
          : null,

        productionVolumeMl: input.productionVolumeMl,

        items: {
          create: input.items.map((item) => ({
            ingredientId: item.ingredientId,

            quantity: new Prisma.Decimal(item.quantity),
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

      product: {
        shopId: shop.id,
      },
    },

    select: {
      id: true,
      productId: true,

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
    // ------------------------------------------
    // SUPPRESSION DES ITEMS RETIRÉS
    // ------------------------------------------

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

    // ------------------------------------------
    // MISE À JOUR / CRÉATION
    // ------------------------------------------

    for (const item of input.items) {
      if (item.id) {
        await tx.recipeItem.update({
          where: {
            id: item.id,
          },

          data: {
            ingredientId: item.ingredientId,

            quantity: new Prisma.Decimal(item.quantity),
          },
        });
      } else {
        await tx.recipeItem.create({
          data: {
            recipeId,

            ingredientId: item.ingredientId,

            quantity: new Prisma.Decimal(item.quantity),
          },
        });
      }
    }

    // ------------------------------------------
    // MISE À JOUR RECETTE
    // ------------------------------------------

    return tx.recipe.update({
      where: {
        id: recipeId,
      },

      data: {
        name: input.name.trim(),

        description: input.description?.trim()
          ? input.description.trim()
          : null,

        productionVolumeMl: input.productionVolumeMl,
      },

      select: recipeSelect,
    });
  });

  return mapRecipe(recipe);
}

// ======================================================
// SUPPRIMER UNE RECETTE
// ======================================================
//
// Une recette n'est plus "utilisée par plusieurs
// produits". Elle appartient à un seul produit.
//
// Supprimer la recette ne supprime donc PAS le produit.
//
// Les RecipeItem sont supprimés automatiquement
// grâce à onDelete: Cascade.
//

export async function deleteRecipe(recipeId: string): Promise<RecipeData> {
  const shop = await getMainShop();

  // --------------------------------------------------
  // RECETTE
  // --------------------------------------------------

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,

      product: {
        shopId: shop.id,
      },
    },

    select: recipeSelect,
  });

  if (!recipe) {
    throw new Error("RECIPE_NOT_FOUND");
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
