import { prisma } from "@/lib/prisma";

import type {
  AdjustPackagingStockInput,
  CreatePackagingInput,
  UpdatePackagingInput,
} from "./packaging.schema";

import { Prisma } from "@/app/generated/prisma/client";

const packagingSelect = {
  id: true,
  shopId: true,
  name: true,
  size: true,
  capacityMl: true,
  stockQty: true,
  minAlert: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PackagingEntity = Prisma.PackagingGetPayload<{
  select: typeof packagingSelect;
}>;

const mapPackaging = (packaging: PackagingEntity) => {
  return {
    id: packaging.id,
    shopId: packaging.shopId,
    name: packaging.name,
    size: packaging.size,

    // Toujours retourner des primitives JS au client
    capacityMl: Number(packaging.capacityMl),
    stockQty: Number(packaging.stockQty),
    minAlert: Number(packaging.minAlert),

    isActive: packaging.isActive,

    // Éviter de laisser des objets Date Prisma
    createdAt: packaging.createdAt.toISOString(),
    updatedAt: packaging.updatedAt.toISOString(),
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

const getPackagingForShop = async (packagingId: string, shopId: string) => {
  const packaging = await prisma.packaging.findFirst({
    where: {
      id: packagingId,
      shopId,
    },
    select: packagingSelect,
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  return packaging;
};

const validatePackagingSize = (
  size: CreatePackagingInput["size"],
  capacityMl: number,
) => {
  if (size === "ML_200" && capacityMl !== 200) {
    throw new Error("INVALID_PACKAGING_CAPACITY");
  }

  if (size === "ML_500" && capacityMl !== 500) {
    throw new Error("INVALID_PACKAGING_CAPACITY");
  }
};

export const getPackagings = async (managerId: string) => {
  const shop = await getShopByOwnerId(managerId);

  const packagings = await prisma.packaging.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        size: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: packagingSelect,
  });

  return packagings.map(mapPackaging);
};

export const getPackaging = async (managerId: string, packagingId: string) => {
  const shop = await getShopByOwnerId(managerId);

  const packaging = await getPackagingForShop(packagingId, shop.id);

  return mapPackaging(packaging);
};

export const createPackaging = async (
  managerId: string,
  data: CreatePackagingInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  const name = data.name.trim();

  validatePackagingSize(data.size, data.capacityMl);

  // Le même nom est autorisé pour une taille différente.
  // L'unicité est donc : shop + nom + taille.
  const existingPackaging = await prisma.packaging.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
      size: data.size,
    },
    select: {
      id: true,
    },
  });

  if (existingPackaging) {
    throw new Error("PACKAGING_ALREADY_EXISTS");
  }

  try {
    const packaging = await prisma.packaging.create({
      data: {
        shopId: shop.id,
        name,
        size: data.size,
        capacityMl: data.capacityMl,
        stockQty: data.stockQty ?? 0,
        minAlert: data.minAlert ?? 50,
        isActive: data.isActive ?? true,
      },
      select: packagingSelect,
    });

    return mapPackaging(packaging);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("PACKAGING_ALREADY_EXISTS");
    }

    throw error;
  }
};

export const updatePackaging = async (
  managerId: string,
  packagingId: string,
  data: UpdatePackagingInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  await getPackagingForShop(packagingId, shop.id);

  const name = data.name.trim();

  validatePackagingSize(data.size, data.capacityMl);

  // Le même nom est autorisé pour une taille différente.
  // On exclut l'emballage actuellement modifié.
  const existingPackaging = await prisma.packaging.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
      size: data.size,
      NOT: {
        id: packagingId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingPackaging) {
    throw new Error("PACKAGING_ALREADY_EXISTS");
  }

  try {
    const packaging = await prisma.packaging.update({
      where: {
        id: packagingId,
      },
      data: {
        name,
        size: data.size,
        capacityMl: data.capacityMl,
        minAlert: data.minAlert,

        ...(data.isActive !== undefined && {
          isActive: data.isActive,
        }),
      },
      select: packagingSelect,
    });

    return mapPackaging(packaging);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("PACKAGING_ALREADY_EXISTS");
    }

    throw error;
  }
};

export const setPackagingActive = async (
  managerId: string,
  packagingId: string,
  isActive: boolean,
) => {
  const shop = await getShopByOwnerId(managerId);

  await getPackagingForShop(packagingId, shop.id);

  const packaging = await prisma.packaging.update({
    where: {
      id: packagingId,
    },
    data: {
      isActive,
    },
    select: packagingSelect,
  });

  return mapPackaging(packaging);
};

export const adjustPackagingStock = async (
  managerId: string,
  packagingId: string,
  data: AdjustPackagingStockInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  const packaging = await getPackagingForShop(packagingId, shop.id);

  const currentStock = Number(packaging.stockQty);

  const adjustment = Number(data.quantity);

  const newStock = currentStock + adjustment;

  if (newStock < 0) {
    throw new Error("INSUFFICIENT_PACKAGING_STOCK");
  }

  const updatedPackaging = await prisma.packaging.update({
    where: {
      id: packagingId,
    },
    data: {
      stockQty: newStock,
    },
    select: packagingSelect,
  });

  return mapPackaging(updatedPackaging);
};

export const deletePackaging = async (
  managerId: string,
  packagingId: string,
) => {
  const shop = await getShopByOwnerId(managerId);

  const packaging = await getPackagingForShop(packagingId, shop.id);

  const [variantsCount, purchasesCount, productionUsagesCount, lossesCount] =
    await Promise.all([
      prisma.productVariant.count({
        where: {
          packagingId: packaging.id,
        },
      }),

      prisma.rawMaterialPurchase.count({
        where: {
          packagingId: packaging.id,
        },
      }),

      prisma.productionPackaging.count({
        where: {
          packagingId: packaging.id,
        },
      }),

      prisma.loss.count({
        where: {
          packagingId: packaging.id,
        },
      }),
    ]);

  const hasHistory =
    variantsCount > 0 ||
    purchasesCount > 0 ||
    productionUsagesCount > 0 ||
    lossesCount > 0;

  if (hasHistory) {
    throw new Error("PACKAGING_HAS_HISTORY");
  }

  if (Number(packaging.stockQty) > 0) {
    throw new Error("PACKAGING_HAS_STOCK");
  }

  await prisma.packaging.delete({
    where: {
      id: packaging.id,
    },
  });

  return {
    success: true,
  };
};
