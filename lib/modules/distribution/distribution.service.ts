import { prisma } from "@/lib/prisma";

import type { CreateDistributionInput } from "./distribution.schema";

// ======================================================
// RÉCUPÉRER LE SHOP DE L'UTILISATEUR
// ======================================================

async function getUserShopId(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
      isActive: true,
      isBanned: true,
      shopOwner: {
        select: {
          id: true,
        },
      },
      assignments: {
        where: {
          isActive: true,
        },
        select: {
          shopId: true,
        },
        take: 1,
      },
    },
  });

  console.log("=== DISTRIBUTION USER DEBUG ===");
  console.log({
    userId,
    userFound: !!user,
    role: user?.role,
    isActive: user?.isActive,
    isBanned: user?.isBanned,
    shopOwnerId: user?.shopOwner?.id ?? null,
    assignmentShopId: user?.assignments[0]?.shopId ?? null,
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new Error("USER_INACTIVE");
  }

  if (user.isBanned) {
    throw new Error("USER_BANNED");
  }

  // ----------------------------------------------------
  // MANAGER
  // ----------------------------------------------------

  if (user.role === "MANAGER") {
    if (!user.shopOwner?.id) {
      console.log("=== DISTRIBUTION SHOP ERROR ===");
      console.log("MANAGER sans boutique propriétaire");

      throw new Error("SHOP_NOT_FOUND");
    }

    console.log("=== DISTRIBUTION SHOP DEBUG ===");
    console.log({
      role: "MANAGER",
      shopId: user.shopOwner.id,
      source: "shopOwner",
    });

    return user.shopOwner.id;
  }

  // ----------------------------------------------------
  // EMPLOYEE
  // ----------------------------------------------------

  const shopId = user.assignments[0]?.shopId;

  if (!shopId) {
    console.log("=== DISTRIBUTION SHOP ERROR ===");
    console.log("EMPLOYEE sans assignment active");

    throw new Error("SHOP_NOT_FOUND");
  }

  console.log("=== DISTRIBUTION SHOP DEBUG ===");
  console.log({
    role: "EMPLOYEE",
    shopId,
    source: "assignment",
  });

  return shopId;
}

// ======================================================
// PRODUITS DISPONIBLES POUR UNE DISTRIBUTION
// ======================================================

export async function getDistributionProducts(
  userId: string,
  fromPosId: string | null,
) {
  console.log("\n==================================================");
  console.log("        DISTRIBUTION PRODUCTS - START");
  console.log("==================================================");

  console.log("=== DISTRIBUTION REQUEST DEBUG ===");
  console.log({
    userId,
    fromPosId,
    fromPosIdType: typeof fromPosId,
  });

  // ====================================================
  // 1. RÉCUPÉRER LA BOUTIQUE DE L'UTILISATEUR
  // ====================================================

  const shopId = await getUserShopId(userId);

  console.log("=== DISTRIBUTION SHOP RESOLVED ===");
  console.log({
    userId,
    shopId,
    fromPosId,
  });

  // ====================================================
  // 2. VÉRIFIER LE POINT DE DÉPART
  //
  // null = boutique principale
  // id   = point de vente
  // ====================================================

  if (fromPosId !== null) {
    console.log("=== DISTRIBUTION POS SEARCH ===");
    console.log({
      requestedPosId: fromPosId,
      expectedShopId: shopId,
      requireActive: true,
    });

    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: fromPosId,
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        shopId: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    console.log("=== DISTRIBUTION POS RESULT ===");
    console.log(pointOfSale);

    if (!pointOfSale) {
      console.log("=== DISTRIBUTION POS ERROR ===");
      console.log({
        message: "Aucun POS actif correspondant",
        requestedPosId: fromPosId,
        expectedShopId: shopId,
      });

      throw new Error("POINT_OF_SALE_NOT_FOUND");
    }

    console.log("=== DISTRIBUTION POS VALID ===");
    console.log({
      id: pointOfSale.id,
      shopId: pointOfSale.shopId,
      name: pointOfSale.name,
      code: pointOfSale.code,
      isActive: pointOfSale.isActive,
    });
  } else {
    console.log("=== DISTRIBUTION SOURCE ===");
    console.log("Source = BOUTIQUE PRINCIPALE");
  }

  // ====================================================
  // 3. RÉCUPÉRER LE STOCK FINI
  //
  // pointOfSaleId = null → boutique principale
  // pointOfSaleId = id   → point de vente
  // ====================================================

  console.log("=== DISTRIBUTION STOCK SEARCH ===");
  console.log({
    shopId,
    pointOfSaleId: fromPosId,
    quantityCondition: "> 0",
  });

  const stocks = await prisma.finishedStock.findMany({
    where: {
      shopId,
      pointOfSaleId: fromPosId,
      quantity: {
        gt: 0,
      },
      variant: {
        isActive: true,
        product: {
          isActive: true,
        },
      },
    },
    select: {
      variantId: true,
      quantity: true,
      variant: {
        select: {
          id: true,
          sku: true,
          price: true,
          shelfLifeDays: true,
          product: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          packaging: {
            select: {
              id: true,
              name: true,
              size: true,
              capacityMl: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // ====================================================
  // DEBUG STOCK
  // ====================================================

  console.log("=== DISTRIBUTION STOCK RESULT ===");

  console.log({
    shopId,
    pointOfSaleId: fromPosId,
    stockCount: stocks.length,
  });

  console.log("=== DISTRIBUTION STOCK DETAILS ===");

  console.log(
    stocks.map((stock) => ({
      variantId: stock.variantId,
      quantity: stock.quantity,
      sku: stock.variant.sku,
      productId: stock.variant.product.id,
      productName: stock.variant.product.name,
      packagingId: stock.variant.packaging.id,
      packagingName: stock.variant.packaging.name,
      capacityMl: stock.variant.packaging.capacityMl,
      isActive: true,
    })),
  );

  // ====================================================
  // 4. FORMATER POUR LA DISTRIBUTION
  // ====================================================

  const result = {
    location: {
      type: fromPosId === null ? "MAIN" : "POS",
      pointOfSaleId: fromPosId,
    },

    products: stocks.map((stock) => ({
      variantId: stock.variant.id,

      productId: stock.variant.product.id,

      productName: stock.variant.product.name,

      productImage: stock.variant.product.image,

      sku: stock.variant.sku,

      price: Number(stock.variant.price),

      packagingId: stock.variant.packaging.id,

      packagingName: stock.variant.packaging.name,

      packagingSize: stock.variant.packaging.size,

      capacityMl: stock.variant.packaging.capacityMl,

      quantity: stock.quantity,

      shelfLifeDays: stock.variant.shelfLifeDays,

      isActive: true,
    })),
  };

  // ====================================================
  // DEBUG FINAL
  // ====================================================

  console.log("=== DISTRIBUTION PRODUCTS RESULT ===");

  console.log({
    location: result.location,
    productCount: result.products.length,
    products: result.products.map((product) => ({
      variantId: product.variantId,
      productName: product.productName,
      sku: product.sku,
      quantity: product.quantity,
    })),
  });

  console.log("==================================================");
  console.log("        DISTRIBUTION PRODUCTS - END");
  console.log("==================================================\n");

  return result;
}

// ======================================================
// CRÉER UNE DISTRIBUTION
// ======================================================

export async function createDistribution(
  input: CreateDistributionInput,
  createdById: string,
) {
  return prisma.$transaction(async (tx) => {
    // ==================================================
    // 1. RÉCUPÉRER LA BOUTIQUE DE L'UTILISATEUR
    // ==================================================

    const user = await tx.user.findUnique({
      where: {
        id: createdById,
      },
      select: {
        role: true,
        isActive: true,
        isBanned: true,
        shopOwner: {
          select: {
            id: true,
          },
        },
        assignments: {
          where: {
            isActive: true,
          },
          select: {
            shopId: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!user.isActive) {
      throw new Error("USER_INACTIVE");
    }

    if (user.isBanned) {
      throw new Error("USER_BANNED");
    }

    let shopId: string | undefined;

    if (user.role === "MANAGER") {
      shopId = user.shopOwner?.id;
    } else {
      shopId = user.assignments[0]?.shopId;
    }

    if (!shopId) {
      throw new Error("SHOP_NOT_FOUND");
    }

    // ==================================================
    // 2. VÉRIFIER LES POINTS DE VENTE
    // ==================================================

    const posIds = [input.fromPosId, input.toPosId].filter(
      (id): id is string => id !== null,
    );

    const uniquePosIds = [...new Set(posIds)];

    if (uniquePosIds.length > 0) {
      const pointsOfSale = await tx.pointOfSale.findMany({
        where: {
          id: {
            in: uniquePosIds,
          },
          shopId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

      if (pointsOfSale.length !== uniquePosIds.length) {
        throw new Error("POINT_OF_SALE_NOT_FOUND");
      }
    }

    // ==================================================
    // 3. CRÉER LE TRANSFERT
    // ==================================================

    const transfer = await tx.stockTransfer.create({
      data: {
        shopId,
        fromPosId: input.fromPosId,
        toPosId: input.toPosId,
        createdById,
        items: {
          create: input.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // ==================================================
    // 4. TRAITER CHAQUE PRODUIT
    // ==================================================

    for (const item of input.items) {
      // ------------------------------------------------
      // 4.1 VÉRIFIER LE PRODUIT
      // ------------------------------------------------

      const variant = await tx.productVariant.findFirst({
        where: {
          id: item.variantId,
          isActive: true,
          product: {
            shopId,
            isActive: true,
          },
        },
        select: {
          id: true,
          sku: true,
          price: true,
          shelfLifeDays: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!variant) {
        throw new Error("PRODUCT_VARIANT_NOT_FOUND");
      }

      // ------------------------------------------------
      // 4.2 VÉRIFIER LE STOCK SOURCE
      // ------------------------------------------------

      const sourceStock = await tx.finishedStock.findFirst({
        where: {
          shopId,
          pointOfSaleId: input.fromPosId,
          variantId: item.variantId,
        },
      });

      if (!sourceStock) {
        throw new Error("SOURCE_STOCK_NOT_FOUND");
      }

      if (sourceStock.quantity < item.quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // ------------------------------------------------
      // 4.3 RÉCUPÉRER LES LOTS DISPONIBLES
      // ------------------------------------------------

      const now = new Date();

      const sourceLots = await tx.finishedStockLot.findMany({
        where: {
          finishedStockId: sourceStock.id,
          remainingQuantity: {
            gt: 0,
          },
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],
        },
        orderBy: [
          {
            expiresAt: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

      const availableLotQuantity = sourceLots.reduce(
        (total, lot) => total + lot.remainingQuantity,
        0,
      );

      if (availableLotQuantity < item.quantity) {
        throw new Error("INSUFFICIENT_AVAILABLE_LOTS");
      }

      // ------------------------------------------------
      // 4.4 STOCK DESTINATION
      // ------------------------------------------------

      let destinationStock = await tx.finishedStock.findFirst({
        where: {
          shopId,
          pointOfSaleId: input.toPosId,
          variantId: item.variantId,
        },
      });

      if (!destinationStock) {
        destinationStock = await tx.finishedStock.create({
          data: {
            shopId,
            pointOfSaleId: input.toPosId,
            variantId: item.variantId,
            quantity: 0,
          },
        });
      }

      // ------------------------------------------------
      // 4.5 ENTRÉE DE STOCK DESTINATION
      // ------------------------------------------------

      const destinationEntry = await tx.finishedStockEntry.create({
        data: {
          finishedStockId: destinationStock.id,
          quantity: item.quantity,
          origin: "TRANSFERT",
          note: `Distribution depuis ${
            input.fromPosId ? "un point de vente" : "la boutique principale"
          }`,
          createdById,
        },
      });

      // ------------------------------------------------
      // 4.6 TRANSFERT FIFO DES LOTS
      // ------------------------------------------------

      let quantityToTransfer = item.quantity;

      for (const sourceLot of sourceLots) {
        if (quantityToTransfer <= 0) {
          break;
        }

        const quantityFromLot = Math.min(
          sourceLot.remainingQuantity,
          quantityToTransfer,
        );

        await tx.finishedStockLot.update({
          where: {
            id: sourceLot.id,
          },
          data: {
            remainingQuantity: {
              decrement: quantityFromLot,
            },
          },
        });

        await tx.finishedStockLot.create({
          data: {
            finishedStockId: destinationStock.id,
            entryId: destinationEntry.id,
            quantity: quantityFromLot,
            remainingQuantity: quantityFromLot,
            expiresAt: sourceLot.expiresAt,
          },
        });

        quantityToTransfer -= quantityFromLot;
      }

      if (quantityToTransfer > 0) {
        throw new Error("LOT_TRANSFER_FAILED");
      }

      // ------------------------------------------------
      // 4.7 DIMINUER LE STOCK SOURCE
      // ------------------------------------------------

      await tx.finishedStock.update({
        where: {
          id: sourceStock.id,
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      // ------------------------------------------------
      // 4.8 AUGMENTER LE STOCK DESTINATION
      // ------------------------------------------------

      await tx.finishedStock.update({
        where: {
          id: destinationStock.id,
        },
        data: {
          quantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // ==================================================
    // 5. RETOURNER LE TRANSFERT
    // ==================================================

    return tx.stockTransfer.findUnique({
      where: {
        id: transfer.id,
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                packaging: {
                  select: {
                    id: true,
                    name: true,
                    size: true,
                    capacityMl: true,
                  },
                },
              },
            },
          },
        },
        fromPos: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toPos: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
}
