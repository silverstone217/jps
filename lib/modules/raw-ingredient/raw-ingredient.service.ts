import { prisma } from "@/lib/prisma";
import type {
  AdjustRawIngredientStockInput,
  CreateRawIngredientInput,
  UpdateRawIngredientInput,
} from "./raw-ingredient.schema";
import { Prisma } from "@/app/generated/prisma/client";

// ============================================================
// SELECT
// ============================================================

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

// ============================================================
// SHOP
// ============================================================

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

// ============================================================
// GET ONE
// ============================================================

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

// ============================================================
// GET ALL
// ============================================================

export const getRawIngredients = async (managerId: string) => {
  const shop = await getShopByOwnerId(managerId);

  return prisma.rawIngredient.findMany({
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
};

// ============================================================
// GET ONE
// ============================================================

export const getRawIngredient = async (
  managerId: string,
  ingredientId: string,
) => {
  const shop = await getShopByOwnerId(managerId);

  return getRawIngredientForShop(ingredientId, shop.id);
};

// ============================================================
// CREATE
// ============================================================

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

  try {
    return await prisma.rawIngredient.create({
      data: {
        shopId: shop.id,
        name,
        unit: data.unit,
        stockQty: new Prisma.Decimal(data.stockQty ?? 0),
        minAlert: new Prisma.Decimal(data.minAlert ?? 5),
        isActive: data.isActive ?? true,
      },
      select: rawIngredientSelect,
    });
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

// ============================================================
// UPDATE
// ============================================================

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
    return await prisma.rawIngredient.update({
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

// ============================================================
// ACTIVATE / DEACTIVATE
// ============================================================

export const setRawIngredientActive = async (
  managerId: string,
  ingredientId: string,
  isActive: boolean,
) => {
  const shop = await getShopByOwnerId(managerId);

  await getRawIngredientForShop(ingredientId, shop.id);

  return prisma.rawIngredient.update({
    where: {
      id: ingredientId,
    },
    data: {
      isActive,
    },
    select: rawIngredientSelect,
  });
};

// ============================================================
// ADJUST STOCK
// ============================================================

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

  return prisma.rawIngredient.update({
    where: {
      id: ingredientId,
    },
    data: {
      stockQty: newStock,
    },
    select: rawIngredientSelect,
  });
};

// ============================================================
// DELETE
// ============================================================

export const deleteRawIngredient = async (
  managerId: string,
  ingredientId: string,
) => {
  const shop = await getShopByOwnerId(managerId);

  const ingredient = await getRawIngredientForShop(ingredientId, shop.id);

  const [recipeItemsCount, purchasesCount, productionUsagesCount, lossesCount] =
    await Promise.all([
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
    ]);

  const hasHistory =
    recipeItemsCount > 0 ||
    purchasesCount > 0 ||
    productionUsagesCount > 0 ||
    lossesCount > 0;

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
