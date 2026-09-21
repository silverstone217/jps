import type { Role } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  AssignOrderPosInput,
  CreateOrderCustomerInput,
  GetOrderCustomerInput,
  GetOrderLoyaltyInput,
  GetOrderProductsInput,
  ValidateOrderInput,
} from "./order.schema";

// ============================================================
// TYPES
// ============================================================

type AuthenticatedUser = {
  id: string;
  role: Role;
};

type OrderPos = {
  id: string;
  name: string;
  code: string;
  telephone: string | null;
  address: string | null;
  isMainStore: boolean;
  isAssigned: boolean;
  canSelect: boolean;
};

// ============================================================
// RÉCUPÉRER LA BOUTIQUE DE L'UTILISATEUR
// ============================================================

async function getUserShop(user: AuthenticatedUser) {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  // ==========================================================
  // MANAGER
  // ==========================================================

  if (user.role === "MANAGER") {
    if (shop.ownerId !== user.id) {
      throw new Error("SHOP_NOT_FOUND");
    }
  }

  // ==========================================================
  // EMPLOYEE
  // ==========================================================

  return shop;
}

// ============================================================
// POS AUTORISÉ
// ============================================================

async function getAuthorizedPos(
  user: AuthenticatedUser,
  pointOfSaleId: string,
) {
  const shop = await getUserShop(user);

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId: shop.id,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POS_NOT_FOUND");
  }

  /**
   * MANAGER :
   * peut travailler dans n'importe quel POS actif.
   */

  if (user.role === "MANAGER") {
    return {
      shop,
      pointOfSale,
    };
  }

  /**
   * EMPLOYEE :
   * doit obligatoirement avoir une affectation active
   * vers ce POS.
   */

  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: user.id,
      shopId: shop.id,
      pointOfSaleId: pointOfSale.id,
      isActive: true,
    },
  });

  if (!assignment) {
    throw new Error("POS_NOT_ASSIGNED");
  }

  return {
    shop,
    pointOfSale,
  };
}

// ============================================================
// POS DISPONIBLES POUR LES COMMANDES
// ============================================================

export async function getOrderPos(
  user: AuthenticatedUser,
): Promise<OrderPos[]> {
  const shop = await getUserShop(user);

  const [pointOfSales, assignments] = await Promise.all([
    // --------------------------------------------------------
    // Tous les POS actifs de la boutique
    // --------------------------------------------------------

    prisma.pointOfSale.findMany({
      where: {
        shopId: shop.id,
        isActive: true,
      },

      orderBy: [
        {
          isMainStore: "desc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        code: true,
        telephone: true,
        address: true,
        isMainStore: true,
      },
    }),

    // --------------------------------------------------------
    // Affectations actives de l'utilisateur
    // --------------------------------------------------------

    prisma.staffAssignment.findMany({
      where: {
        userId: user.id,
        shopId: shop.id,
        isActive: true,
      },

      select: {
        pointOfSaleId: true,
      },
    }),
  ]);

  const assignedPosIds = new Set(
    assignments.map((assignment) => assignment.pointOfSaleId),
  );

  // ==========================================================
  // CONSTRUIRE LA RÉPONSE
  // ==========================================================

  return pointOfSales.map((pointOfSale) => {
    const isAssigned = assignedPosIds.has(pointOfSale.id);

    // ------------------------------------------------------
    // MANAGER
    // ------------------------------------------------------

    if (user.role === "MANAGER") {
      return {
        ...pointOfSale,
        isAssigned,
        canSelect: true,
      };
    }

    // ------------------------------------------------------
    // EMPLOYEE
    // ------------------------------------------------------

    return {
      ...pointOfSale,
      isAssigned,
      canSelect: !pointOfSale.isMainStore,
    };
  });
}

// ============================================================
// ASSIGNATION POS
// ============================================================

export async function assignOrderPos(
  user: AuthenticatedUser,
  input: AssignOrderPosInput,
) {
  const shop = await getUserShop(user);

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: input.pointOfSaleId,
      shopId: shop.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      telephone: true,
      address: true,
      isMainStore: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POS_NOT_FOUND");
  }

  /**
   * Un EMPLOYEE ne peut jamais s'assigner
   * au POS principal.
   */

  if (user.role === "EMPLOYEE" && pointOfSale.isMainStore) {
    throw new Error("EMPLOYEE_CANNOT_ASSIGN_MAIN_STORE");
  }

  /**
   * On utilise une transaction :
   *
   * 1. désactiver les anciennes affectations actives
   * 2. chercher une éventuelle affectation existante
   * 3. la réactiver ou en créer une nouvelle
   */

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.staffAssignment.updateMany({
      where: {
        userId: user.id,
        shopId: shop.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const existing = await tx.staffAssignment.findFirst({
      where: {
        userId: user.id,
        shopId: shop.id,
        pointOfSaleId: pointOfSale.id,
      },
    });

    if (existing) {
      return tx.staffAssignment.update({
        where: {
          id: existing.id,
        },
        data: {
          isActive: true,
        },
        select: {
          id: true,
          userId: true,
          shopId: true,
          pointOfSaleId: true,
          isActive: true,
        },
      });
    }

    return tx.staffAssignment.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        pointOfSaleId: pointOfSale.id,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        shopId: true,
        pointOfSaleId: true,
        isActive: true,
      },
    });
  });

  return {
    assignment,
    pointOfSale,
  };
}

// ============================================================
// PRODUITS DISPONIBLES
// ============================================================

export async function getOrderProducts(
  user: AuthenticatedUser,
  input: GetOrderProductsInput,
) {
  const { shop, pointOfSale } = await getAuthorizedPos(
    user,
    input.pointOfSaleId,
  );

  const stocks = await prisma.finishedStock.findMany({
    where: {
      shopId: shop.id,
      pointOfSaleId: pointOfSale.id,
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
    orderBy: {
      variant: {
        product: {
          name: "asc",
        },
      },
    },
    select: {
      id: true,
      quantity: true,
      variant: {
        select: {
          id: true,
          sku: true,
          price: true,
          product: {
            select: {
              id: true,
              name: true,
              description: true,
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
  });

  return {
    pointOfSale: {
      id: pointOfSale.id,
      name: pointOfSale.name,
      code: pointOfSale.code,
      telephone: pointOfSale.telephone,
      address: pointOfSale.address,
      isMainStore: pointOfSale.isMainStore,
    },

    products: stocks.map((stock) => ({
      variantId: stock.variant.id,
      productId: stock.variant.product.id,
      name: stock.variant.product.name,
      description: stock.variant.product.description,
      image: stock.variant.product.image,
      sku: stock.variant.sku,
      price: Number(stock.variant.price),
      quantity: stock.quantity,
      packaging: {
        id: stock.variant.packaging.id,
        name: stock.variant.packaging.name,
        size: stock.variant.packaging.size,
        capacityMl: stock.variant.packaging.capacityMl,
      },
    })),
  };
}

// ============================================================
// CLIENT
// ============================================================

export async function getOrderCustomer(
  user: AuthenticatedUser,
  input: GetOrderCustomerInput,
) {
  // ==========================================================
  // VÉRIFIER LA BOUTIQUE
  // ==========================================================

  await getUserShop(user);

  // ==========================================================
  // RECHERCHER LE CLIENT
  // ==========================================================

  const customer = await prisma.customer.findUnique({
    where: {
      phone: input.phone,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  return {
    customer,
  };
}

export async function createOrderCustomer(
  user: AuthenticatedUser,
  input: CreateOrderCustomerInput,
) {
  // ==========================================================
  // VÉRIFIER LA BOUTIQUE
  // ==========================================================

  await getUserShop(user);

  // ==========================================================
  // VÉRIFIER SI LE NUMÉRO EXISTE DÉJÀ
  // ==========================================================

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      phone: input.phone,
    },
    select: {
      id: true,
    },
  });

  if (existingCustomer) {
    throw new Error("CUSTOMER_ALREADY_EXISTS");
  }

  // ==========================================================
  // CRÉER LE CLIENT
  // ==========================================================

  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      phone: input.phone,
      loyaltyPoints: 0,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
    },
  });

  return {
    customer,
  };
}

// ============================================================
// FIDÉLITÉ
// ============================================================

export async function getOrderLoyalty(
  user: AuthenticatedUser,
  input: GetOrderLoyaltyInput,
) {
  const { shop } = await getAuthorizedPos(user, input.pointOfSaleId);

  const customer = await prisma.customer.findUnique({
    where: {
      id: input.customerId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const variantIds = input.items.map((item) => item.variantId);

  const variants = await prisma.productVariant.findMany({
    where: {
      id: {
        in: variantIds,
      },
      isActive: true,
      product: {
        isActive: true,
      },
    },
    select: {
      id: true,
      price: true,
    },
  });

  if (variants.length !== new Set(variantIds).size) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const priceMap = new Map(
    variants.map((variant) => [variant.id, Number(variant.price)]),
  );

  let subtotal = 0;

  for (const item of input.items) {
    const unitPrice = priceMap.get(item.variantId);

    if (unitPrice === undefined) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    subtotal += unitPrice * item.quantity;
  }

  // ==========================================================
  // POINTS GAGNÉS
  // ==========================================================

  const loyaltyPurchaseAmount = Number(shop.loyaltyPurchaseAmount);

  const loyaltyPointsEarned = shop.loyaltyPointsEarned;

  const pointsEarned =
    loyaltyPurchaseAmount > 0
      ? Math.floor(subtotal / loyaltyPurchaseAmount) * loyaltyPointsEarned
      : 0;

  // ==========================================================
  // RÉDUCTION PAR POINTS
  // ==========================================================

  const loyaltyPointsForDiscount = shop.loyaltyPointsForDiscount;

  const loyaltyDiscountAmount = Number(shop.loyaltyDiscountAmount);

  const availablePoints = customer.loyaltyPoints;

  const usablePoints =
    loyaltyPointsForDiscount > 0
      ? Math.floor(availablePoints / loyaltyPointsForDiscount) *
        loyaltyPointsForDiscount
      : 0;

  const maxDiscount =
    loyaltyDiscountAmount > 0 && loyaltyPointsForDiscount > 0
      ? Math.floor(
          Math.min(
            availablePoints / loyaltyPointsForDiscount,
            subtotal / loyaltyDiscountAmount,
          ),
        ) * loyaltyPointsForDiscount
      : 0;

  const maxDiscountAmount =
    loyaltyPointsForDiscount > 0
      ? Math.floor(maxDiscount / loyaltyPointsForDiscount) *
        loyaltyDiscountAmount
      : 0;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      currentPoints: customer.loyaltyPoints,
    },

    order: {
      subtotal,
    },

    earning: {
      purchaseAmount: loyaltyPurchaseAmount,
      points: loyaltyPointsEarned,
      pointsEarned,
    },

    redemption: {
      pointsRequired: loyaltyPointsForDiscount,
      discountAmount: loyaltyDiscountAmount,
      availablePoints,
      usablePoints,
      maxPointsUsable: maxDiscount,
      maxDiscountAmount,
    },

    balance: {
      pointsAfterPurchase: customer.loyaltyPoints + pointsEarned,
    },
  };
}

// ============================================================
// VALIDATION DE LA COMMANDE
// ============================================================

export async function validateOrder(
  user: AuthenticatedUser,
  input: ValidateOrderInput,
) {
  // ==========================================================
  // AUTORISATION POS
  // ==========================================================

  const { shop, pointOfSale } = await getAuthorizedPos(
    user,
    input.pointOfSaleId,
  );

  // ==========================================================
  // TRANSACTION
  // ==========================================================

  return prisma.$transaction(async (tx) => {
    // ========================================================
    // CLIENT
    // ========================================================

    let customer: {
      id: string;
      name: string | null;
      phone: string;
      loyaltyPoints: number;
    } | null = null;

    if (input.customer) {
      if (input.customer.id) {
        customer = await tx.customer.findUnique({
          where: {
            id: input.customer.id,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
          },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        // Le téléphone doit correspondre
        // au client identifié.
        if (customer.phone !== input.customer.phone) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }
      } else {
        customer = await tx.customer.findUnique({
          where: {
            phone: input.customer.phone,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
          },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }
      }
    }

    // ========================================================
    // PRODUITS / STOCK
    // ========================================================

    const variantIds = input.items.map((item) => item.variantId);

    const uniqueVariantIds = new Set(variantIds);

    if (uniqueVariantIds.size !== variantIds.length) {
      throw new Error("DUPLICATE_PRODUCT");
    }

    const stocks = await tx.finishedStock.findMany({
      where: {
        shopId: shop.id,
        pointOfSaleId: pointOfSale.id,
        variantId: {
          in: variantIds,
        },
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
        id: true,
        quantity: true,
        variant: {
          select: {
            id: true,
            sku: true,
            price: true,

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
    });

    if (stocks.length !== uniqueVariantIds.size) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const stockMap = new Map(stocks.map((stock) => [stock.variant.id, stock]));

    // ========================================================
    // VÉRIFIER LES QUANTITÉS
    // ========================================================

    for (const item of input.items) {
      const stock = stockMap.get(item.variantId);

      if (!stock) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      if (item.quantity > stock.quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    // ========================================================
    // CALCUL DU SOUS-TOTAL
    // ========================================================

    let subtotal = 0;

    for (const item of input.items) {
      const stock = stockMap.get(item.variantId);

      if (!stock) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const unitPrice = Number(stock.variant.price);

      subtotal += unitPrice * item.quantity;
    }

    // ========================================================
    // POINTS GAGNÉS
    // ========================================================

    const loyaltyPurchaseAmount = Number(shop.loyaltyPurchaseAmount);

    const loyaltyPointsEarned = shop.loyaltyPointsEarned;

    const pointsEarned =
      customer && loyaltyPurchaseAmount > 0
        ? Math.floor(subtotal / loyaltyPurchaseAmount) * loyaltyPointsEarned
        : 0;

    // ========================================================
    // RÉDUCTION FIDÉLITÉ
    // ========================================================

    let pointsUsed = 0;
    let discountAmount = 0;

    if (input.pointsUsed > 0) {
      if (!customer) {
        throw new Error("CUSTOMER_REQUIRED_FOR_LOYALTY");
      }

      const pointsRequired = shop.loyaltyPointsForDiscount;

      const discountPerBlock = Number(shop.loyaltyDiscountAmount);

      if (pointsRequired <= 0 || discountPerBlock <= 0) {
        throw new Error("LOYALTY_REDEMPTION_NOT_AVAILABLE");
      }

      // Les points doivent respecter
      // le bloc défini par la boutique.
      if (input.pointsUsed % pointsRequired !== 0) {
        throw new Error("INVALID_LOYALTY_POINTS");
      }

      // Le client ne peut pas dépenser
      // plus de points qu'il n'en possède.
      if (input.pointsUsed > customer.loyaltyPoints) {
        throw new Error("INSUFFICIENT_LOYALTY_POINTS");
      }

      // Limite imposée par le montant
      // de la commande.
      const maxPointsUsable =
        Math.floor(subtotal / discountPerBlock) * pointsRequired;

      if (input.pointsUsed > maxPointsUsable) {
        throw new Error("LOYALTY_DISCOUNT_TOO_HIGH");
      }

      pointsUsed = input.pointsUsed;

      discountAmount =
        Math.floor(pointsUsed / pointsRequired) * discountPerBlock;
    }

    // ========================================================
    // TOTAL
    // ========================================================

    const totalAmount = Math.max(subtotal - discountAmount, 0);

    // ========================================================
    // SOLDE FIDÉLITÉ FINAL
    // ========================================================

    const loyaltyBalanceAfter = customer
      ? customer.loyaltyPoints - pointsUsed + pointsEarned
      : 0;

    // ========================================================
    // VENDEUR
    // ========================================================

    const seller = await tx.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!seller) {
      throw new Error("USER_NOT_FOUND");
    }

    // ========================================================
    // NUMÉRO DE REÇU
    // ========================================================

    const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    // ========================================================
    // VENTE
    // ========================================================

    const sale = await tx.sale.create({
      data: {
        receiptNumber,
        pointOfSaleId: pointOfSale.id,
        sellerId: seller.id,
        customerId: customer?.id ?? null,

        subtotal,
        discountAmount,
        totalAmount,

        pointsEarned,
        pointsUsed,

        paymentMethod: input.paymentMethod,
      },

      select: {
        id: true,
        receiptNumber: true,
        pointOfSaleId: true,
        sellerId: true,
        customerId: true,
        subtotal: true,
        discountAmount: true,
        totalAmount: true,
        pointsEarned: true,
        pointsUsed: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    // ========================================================
    // LIGNES DE VENTE
    // ========================================================

    for (const item of input.items) {
      const stock = stockMap.get(item.variantId);

      if (!stock) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const unitPrice = Number(stock.variant.price);

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          variantId: stock.variant.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: unitPrice * item.quantity,
        },
      });
    }

    // ========================================================
    // DÉCRÉMENT DU STOCK
    // ========================================================

    for (const item of input.items) {
      const stock = stockMap.get(item.variantId);

      if (!stock) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const updated = await tx.finishedStock.updateMany({
        where: {
          id: stock.id,
          quantity: {
            gte: item.quantity,
          },
        },

        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      if (updated.count !== 1) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    // ========================================================
    // FIDÉLITÉ
    // ========================================================

    if (customer) {
      // ------------------------------------------------------
      // EARN
      // ------------------------------------------------------

      if (pointsEarned > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            type: "EARN",
            points: pointsEarned,
            balanceAfter: loyaltyBalanceAfter,
            reason: "Points gagnés lors de la vente",
          },
        });
      }

      // ------------------------------------------------------
      // REDEEM
      // ------------------------------------------------------

      if (pointsUsed > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            type: "REDEEM",
            points: pointsUsed,
            balanceAfter: loyaltyBalanceAfter,
            reason: "Points utilisés lors de la vente",
          },
        });
      }

      // ------------------------------------------------------
      // NOUVEAU SOLDE
      // ------------------------------------------------------

      await tx.customer.update({
        where: {
          id: customer.id,
        },

        data: {
          loyaltyPoints: loyaltyBalanceAfter,
        },
      });
    }

    // ========================================================
    // FACTURE
    // ========================================================

    const invoiceNumber = `FAC-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    const invoice = await tx.invoice.create({
      data: {
        saleId: sale.id,

        invoiceNumber,

        status: "GENERATED",

        // --------------------------------------------------
        // SNAPSHOT BOUTIQUE
        // --------------------------------------------------

        shopName: shop.name,

        // --------------------------------------------------
        // SNAPSHOT POS
        // --------------------------------------------------

        pointOfSaleName: pointOfSale.name,

        pointOfSaleAddress: pointOfSale.address,

        pointOfSaleTelephone: pointOfSale.telephone,

        // --------------------------------------------------
        // SNAPSHOT VENDEUR
        // --------------------------------------------------

        sellerName: seller.name,

        // --------------------------------------------------
        // SNAPSHOT FACTURE
        // --------------------------------------------------

        currency: shop.currency,

        subtotal,
        discountAmount,
        totalAmount,

        pointsEarned,
        pointsUsed,

        // --------------------------------------------------
        // SNAPSHOT CLIENT
        // --------------------------------------------------

        customerName: customer?.name ?? null,

        customerPhone: customer?.phone ?? null,
      },

      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currency: true,

        shopName: true,

        pointOfSaleName: true,
        pointOfSaleAddress: true,
        pointOfSaleTelephone: true,

        subtotal: true,
        discountAmount: true,
        totalAmount: true,

        customerName: true,
        customerPhone: true,
        pointsEarned: true,
        pointsUsed: true,

        createdAt: true,
      },
    });

    // ========================================================
    // LIGNES DE FACTURE
    // ========================================================

    const invoiceItems = await Promise.all(
      input.items.map(async (item) => {
        const stock = stockMap.get(item.variantId);

        if (!stock) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const unitPrice = Number(stock.variant.price);

        const itemSubtotal = unitPrice * item.quantity;

        return tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,

            productName: stock.variant.product.name,

            size: stock.variant.packaging.size,

            quantity: item.quantity,

            unitPrice,

            subtotal: itemSubtotal,

            currency: shop.currency,
          },

          select: {
            id: true,
            productName: true,
            size: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            currency: true,
          },
        });
      }),
    );

    // ========================================================
    // RÉSULTAT CLIENT
    // ========================================================

    const updatedCustomer = customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          loyaltyPoints: loyaltyBalanceAfter,
        }
      : null;

    // ========================================================
    // RÉPONSE
    // ========================================================

    return {
      sale: {
        id: sale.id,

        receiptNumber: sale.receiptNumber,

        pointOfSaleId: sale.pointOfSaleId,

        sellerId: sale.sellerId,

        customerId: sale.customerId,

        subtotal: Number(sale.subtotal),

        discountAmount: Number(sale.discountAmount),

        totalAmount: Number(sale.totalAmount),

        pointsEarned: sale.pointsEarned,

        pointsUsed: sale.pointsUsed,

        paymentMethod: sale.paymentMethod,

        createdAt: sale.createdAt.toISOString(),
      },

      invoice: {
        id: invoice.id,

        invoiceNumber: invoice.invoiceNumber,

        status: invoice.status,

        currency: invoice.currency,

        shopName: invoice.shopName,

        pointOfSaleName: invoice.pointOfSaleName,

        pointOfSaleAddress: invoice.pointOfSaleAddress,

        pointOfSaleTelephone: invoice.pointOfSaleTelephone,

        subtotal: Number(invoice.subtotal),

        discountAmount: Number(invoice.discountAmount),

        totalAmount: Number(invoice.totalAmount),

        customerName: invoice.customerName,

        customerPhone: invoice.customerPhone,
        pointsEarned: invoice.pointsEarned,
        pointsUsed: invoice.pointsUsed,

        createdAt: invoice.createdAt.toISOString(),

        items: invoiceItems.map((item) => ({
          id: item.id,
          productName: item.productName,
          size: item.size,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
          currency: item.currency,
        })),
      },

      customer: updatedCustomer,
    };
  });
}
