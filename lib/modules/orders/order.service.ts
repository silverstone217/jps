import type { Role } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  AssignOrderPosInput,
  CreateOrderCustomerInput,
  GetOrderCustomerInput,
  GetOrderProductsInput,
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
// SHOP
// ============================================================

async function getUserShop(user: AuthenticatedUser) {
  /**
   * Un MANAGER propriétaire est relié directement au Shop
   * via Shop.ownerId.
   *
   * Un EMPLOYEE est relié au Shop via StaffAssignment.
   *
   * On cherche donc d'abord le shop via une affectation active.
   * Cela permet aussi de fonctionner correctement si un manager
   * possède une affectation à un POS.
   */

  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      shopId: true,
    },
  });

  if (assignment) {
    const shop = await prisma.shop.findUnique({
      where: {
        id: assignment.shopId,
      },
    });

    if (shop) {
      return shop;
    }
  }

  /**
   * Si aucune affectation n'existe, un MANAGER peut encore
   * retrouver son shop via ownerId.
   *
   * C'est notamment nécessaire pour permettre au manager
   * de choisir son premier POS.
   */

  if (user.role === "MANAGER") {
    const shop = await prisma.shop.findUnique({
      where: {
        ownerId: user.id,
      },
    });

    if (shop) {
      return shop;
    }
  }

  throw new Error("SHOP_NOT_FOUND");
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
// POS DISPONIBLES
// ============================================================

export async function getOrderPos(
  user: AuthenticatedUser,
): Promise<OrderPos[]> {
  const shop = await getUserShop(user);

  const [pointOfSales, assignments] = await Promise.all([
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

  return pointOfSales.map((pointOfSale) => {
    const isAssigned = assignedPosIds.has(pointOfSale.id);

    /**
     * MANAGER :
     * peut choisir tous les POS actifs,
     * y compris le POS principal.
     *
     * EMPLOYEE :
     * le POS principal est interdit.
     * Les autres POS sont sélectionnables.
     */

    const canSelect = user.role === "MANAGER" ? true : !pointOfSale.isMainStore;

    return {
      ...pointOfSale,
      isAssigned,
      canSelect,
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
