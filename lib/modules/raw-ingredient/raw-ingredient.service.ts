import { prisma } from "@/lib/prisma";

import type {
  AdjustRawIngredientStockInput,
  CreateRawIngredientInput,
  UpdateRawIngredientInput,
} from "./raw-ingredient.schema";

import { Prisma } from "@/app/generated/prisma/client";

const rawIngredientSelect = {
  id: true,
  shopId: true,
  name: true,
  unit: true,
  stockQty: true,
  minAlert: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type RawIngredientEntity = Prisma.RawIngredientGetPayload<{
  select: typeof rawIngredientSelect;
}>;

const mapRawIngredient = (ingredient: RawIngredientEntity) => {
  return {
    id: ingredient.id,
    shopId: ingredient.shopId,
    name: ingredient.name,
    unit: ingredient.unit,
    stockQty: ingredient.stockQty.toNumber(),
    minAlert: ingredient.minAlert.toNumber(),
    isActive: ingredient.isActive,
    createdAt: ingredient.createdAt.toISOString(),
    updatedAt: ingredient.updatedAt.toISOString(),
  };
};

const getShopByOwnerId = async (managerId: string) => {
  const shop = await prisma.shop.findUnique({
    where: {
      ownerId: managerId,
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

const getRawIngredientForShop = async (
  ingredientId: string,
  shopId: string,
) => {
  const ingredient = await prisma.rawIngredient.findFirst({
    where: {
      id: ingredientId,
      shopId,
    },
    select: rawIngredientSelect,
  });

  if (!ingredient) {
    throw new Error("RAW_INGREDIENT_NOT_FOUND");
  }

  return ingredient;
};

export const getRawIngredients = async (managerId: string) => {
  const shop = await getShopByOwnerId(managerId);

  const ingredients = await prisma.rawIngredient.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
    select: rawIngredientSelect,
  });

  return ingredients.map(mapRawIngredient);
};

export const getRawIngredient = async (
  managerId: string,
  ingredientId: string,
) => {
  const shop = await getShopByOwnerId(managerId);

  const ingredient = await getRawIngredientForShop(ingredientId, shop.id);

  return mapRawIngredient(ingredient);
};

export const createRawIngredient = async (
  managerId: string,
  data: CreateRawIngredientInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  const name = data.name.trim();

  const existingIngredient = await prisma.rawIngredient.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existingIngredient) {
    throw new Error("RAW_INGREDIENT_ALREADY_EXISTS");
  }

  const initialStock = new Prisma.Decimal(data.stockQty ?? 0);

  try {
    const ingredient = await prisma.$transaction(async (tx) => {
      const created = await tx.rawIngredient.create({
        data: {
          shopId: shop.id,
          name,
          unit: data.unit,
          stockQty: initialStock,
          minAlert: new Prisma.Decimal(data.minAlert ?? 5),
          isActive: data.isActive ?? true,
        },
        select: rawIngredientSelect,
      });

      /**
       * Le stock initial devient
       * une entrée d'historique.
       *
       * On ne crée pas de ligne si
       * le stock initial est égal à 0.
       */
      if (initialStock.greaterThan(0)) {
        await tx.rawMaterialHistory.create({
          data: {
            shopId: shop.id,
            ingredientId: created.id,
            quantity: initialStock,
            type: "INITIALIZATION",
            note: "Stock initial de l'ingrédient",
            createdById: managerId,
          },
        });
      }

      return created;
    });

    return mapRawIngredient(ingredient);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("RAW_INGREDIENT_ALREADY_EXISTS");
    }

    throw error;
  }
};

export const updateRawIngredient = async (
  managerId: string,
  ingredientId: string,
  data: UpdateRawIngredientInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  await getRawIngredientForShop(ingredientId, shop.id);

  const name = data.name.trim();

  const existingIngredient = await prisma.rawIngredient.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
      NOT: {
        id: ingredientId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingIngredient) {
    throw new Error("RAW_INGREDIENT_ALREADY_EXISTS");
  }

  try {
    const ingredient = await prisma.rawIngredient.update({
      where: {
        id: ingredientId,
      },
      data: {
        name,
        unit: data.unit,
        minAlert: new Prisma.Decimal(data.minAlert),
        ...(data.isActive !== undefined && {
          isActive: data.isActive,
        }),
      },
      select: rawIngredientSelect,
    });

    return mapRawIngredient(ingredient);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("RAW_INGREDIENT_ALREADY_EXISTS");
    }

    throw error;
  }
};

export const setRawIngredientActive = async (
  managerId: string,
  ingredientId: string,
  isActive: boolean,
) => {
  const shop = await getShopByOwnerId(managerId);
  await getRawIngredientForShop(ingredientId, shop.id);
  const ingredient = await prisma.rawIngredient.update({
    where: {
      id: ingredientId,
    },
    data: {
      isActive,
    },
    select: rawIngredientSelect,
  });

  return mapRawIngredient(ingredient);
};

export const adjustRawIngredientStock = async (
  managerId: string,
  ingredientId: string,
  data: AdjustRawIngredientStockInput,
) => {
  const shop = await getShopByOwnerId(managerId);
  const ingredient = await getRawIngredientForShop(ingredientId, shop.id);
  const currentStock = new Prisma.Decimal(ingredient.stockQty);
  const adjustment = new Prisma.Decimal(data.quantity);
  const newStock = currentStock.plus(adjustment);

  if (newStock.lessThan(0)) {
    throw new Error("INSUFFICIENT_RAW_INGREDIENT_STOCK");
  }

  const updatedIngredient = await prisma.$transaction(async (tx) => {
    const updated = await tx.rawIngredient.update({
      where: {
        id: ingredientId,
      },
      data: {
        stockQty: newStock,
      },
      select: rawIngredientSelect,
    });

    await tx.rawMaterialHistory.create({
      data: {
        shopId: shop.id,
        ingredientId: ingredient.id,
        quantity: adjustment,
        type: "ADJUSTMENT",
        note: data.note?.trim() || null,
        createdById: managerId,
      },
    });

    return updated;
  });

  return mapRawIngredient(updatedIngredient);
};

export const deleteRawIngredient = async (
  managerId: string,
  ingredientId: string,
) => {
  const shop = await getShopByOwnerId(managerId);

  const ingredient = await getRawIngredientForShop(ingredientId, shop.id);

  const [
    recipeItemsCount,
    purchasesCount,
    productionUsagesCount,
    lossesCount,
    rawMaterialHistoryCount,
  ] = await Promise.all([
    prisma.recipeItem.count({
      where: {
        ingredientId: ingredient.id,
      },
    }),

    prisma.rawMaterialPurchase.count({
      where: {
        ingredientId: ingredient.id,
      },
    }),

    prisma.productionIngredient.count({
      where: {
        ingredientId: ingredient.id,
      },
    }),

    prisma.loss.count({
      where: {
        ingredientId: ingredient.id,
      },
    }),

    prisma.rawMaterialHistory.count({
      where: {
        ingredientId: ingredient.id,
      },
    }),
  ]);

  const hasHistory =
    recipeItemsCount > 0 ||
    purchasesCount > 0 ||
    productionUsagesCount > 0 ||
    lossesCount > 0 ||
    rawMaterialHistoryCount > 0;

  if (hasHistory) {
    throw new Error("RAW_INGREDIENT_HAS_HISTORY");
  }

  if (new Prisma.Decimal(ingredient.stockQty).greaterThan(0)) {
    throw new Error("RAW_INGREDIENT_HAS_STOCK");
  }

  await prisma.rawIngredient.delete({
    where: {
      id: ingredient.id,
    },
  });

  return {
    success: true,
  };
};
