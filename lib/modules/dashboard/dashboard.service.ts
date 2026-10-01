import type { Role } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

export type DashboardStock = {
  totalQuantity: number;
  variantsCount: number;
};

export type DashboardRecentOrder = {
  id: string;
  createdAt: Date;
};

export type DashboardOrders = {
  today: number;
  recent: DashboardRecentOrder[];
};

export type ManagerDashboard = {
  role: "MANAGER";
  stock: {
    main: DashboardStock;
  };
  employees: {
    total: number;
  };
  pointOfSales: {
    total: number;
  };
  orders: DashboardOrders;
};

export type EmployeeDashboard = {
  role: "EMPLOYEE";
  pointOfSale: {
    id: string;
    name: string;
    code: string;
  } | null;
  stock: DashboardStock;
  orders: DashboardOrders;
};

export type Dashboard = ManagerDashboard | EmployeeDashboard;

/**
 * ============================================================
 * DASHBOARD SERVICE
 * ============================================================
 */

export class DashboardService {
  /**
   * ==========================================================
   * Récupérer la boutique principale
   * ==========================================================
   */

  private static async getMainShop() {
    const shop = await prisma.shop.findUnique({
      where: {
        singleton: "MAIN",
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

  /**
   * ==========================================================
   * Récupérer le point de vente actif d'un utilisateur
   * ==========================================================
   *
   * Utilisé aussi bien pour le manager que pour l'employé.
   *
   * Le POS est déterminé par l'affectation active.
   */

  private static async getActivePointOfSale(userId: string, shopId: string) {
    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        userId,
        shopId,
        isActive: true,
        pointOfSale: {
          isActive: true,
        },
      },
      select: {
        pointOfSale: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return assignment?.pointOfSale ?? null;
  }

  /**
   * ==========================================================
   * Récupérer le stock de produits finis
   * ==========================================================
   *
   * pointOfSaleId = null
   * → stock central de la boutique principale.
   *
   * pointOfSaleId = ID
   * → stock du point de vente concerné.
   */

  private static async getFinishedStock(
    pointOfSaleId: string | null,
  ): Promise<DashboardStock> {
    const stocks = await prisma.finishedStock.findMany({
      where: {
        pointOfSaleId,
        quantity: {
          gt: 0,
        },
      },
      select: {
        quantity: true,
        variantId: true,
      },
    });

    const totalQuantity = stocks.reduce(
      (total, stock) => total + stock.quantity,
      0,
    );

    return {
      totalQuantity,
      variantsCount: stocks.length,
    };
  }

  /**
   * ==========================================================
   * Récupérer le nombre de commandes du jour
   * ==========================================================
   *
   * Manager :
   * → toutes les commandes de la boutique.
   *
   * Employee :
   * → uniquement les commandes de son POS.
   */

  private static async getOrdersToday(
    shopId: string,
    pointOfSaleId?: string,
  ): Promise<number> {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return prisma.sale.count({
      where: {
        pointOfSale: {
          shopId,
        },

        ...(pointOfSaleId
          ? {
              pointOfSaleId,
            }
          : {}),

        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  /**
   * ==========================================================
   * Récupérer les 3 dernières commandes
   * ==========================================================
   *
   * Les commandes sont récupérées depuis Invoice.
   *
   * Uniquement les commandes du POS concerné.
   *
   * Si aucun POS n'est disponible :
   * → aucune commande récente.
   */

  private static async getRecentOrders(
    pointOfSaleId: string | null,
  ): Promise<DashboardRecentOrder[]> {
    if (!pointOfSaleId) {
      return [];
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        pointOfSaleId,
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    return invoices;
  }

  /**
   * ==========================================================
   * Récupérer les statistiques de commandes
   * ==========================================================
   */

  private static async getOrdersDashboard(
    shopId: string,
    pointOfSaleId?: string,
  ): Promise<DashboardOrders> {
    const [today, recent] = await Promise.all([
      this.getOrdersToday(shopId, pointOfSaleId),
      this.getRecentOrders(pointOfSaleId ?? null),
    ]);

    return {
      today,
      recent,
    };
  }

  /**
   * ==========================================================
   * DASHBOARD MANAGER
   * ==========================================================
   *
   * Le manager voit :
   *
   * - le stock central de produits finis
   * - le nombre d'employés actifs
   * - le nombre de POS actifs
   * - toutes les commandes du jour de la boutique
   * - les 3 dernières commandes de son POS actif
   */

  private static async getManagerDashboard(
    userId: string,
    shopId: string,
  ): Promise<ManagerDashboard> {
    const pointOfSale = await this.getActivePointOfSale(userId, shopId);

    const [stock, employeesTotal, pointOfSalesTotal, orders] =
      await Promise.all([
        this.getFinishedStock(null),

        prisma.user.count({
          where: {
            role: "EMPLOYEE",
            isActive: true,
          },
        }),

        prisma.pointOfSale.count({
          where: {
            shopId,
            isActive: true,
          },
        }),

        this.getOrdersDashboard(shopId, pointOfSale?.id),
      ]);

    return {
      role: "MANAGER",

      stock: {
        main: stock,
      },

      employees: {
        total: employeesTotal,
      },

      pointOfSales: {
        total: pointOfSalesTotal,
      },

      orders,
    };
  }

  /**
   * ==========================================================
   * DASHBOARD EMPLOYEE
   * ==========================================================
   *
   * L'employé ne choisit pas son POS.
   *
   * Le POS est déterminé par son affectation active.
   */

  private static async getEmployeeDashboard(
    userId: string,
    shopId: string,
  ): Promise<EmployeeDashboard> {
    const pointOfSale = await this.getActivePointOfSale(userId, shopId);

    /**
     * Aucun POS affecté.
     */
    if (!pointOfSale) {
      return {
        role: "EMPLOYEE",

        pointOfSale: null,

        stock: {
          totalQuantity: 0,
          variantsCount: 0,
        },

        orders: {
          today: 0,
          recent: [],
        },
      };
    }

    const [stock, orders] = await Promise.all([
      this.getFinishedStock(pointOfSale.id),

      this.getOrdersDashboard(shopId, pointOfSale.id),
    ]);

    return {
      role: "EMPLOYEE",

      pointOfSale: {
        id: pointOfSale.id,
        name: pointOfSale.name,
        code: pointOfSale.code,
      },

      stock,

      orders,
    };
  }

  /**
   * ==========================================================
   * DASHBOARD PRINCIPAL
   * ==========================================================
   */

  static async getDashboard(userId: string, role: Role): Promise<Dashboard> {
    const shop = await this.getMainShop();

    if (role === "MANAGER") {
      return this.getManagerDashboard(userId, shop.id);
    }

    if (role === "EMPLOYEE") {
      return this.getEmployeeDashboard(userId, shop.id);
    }

    throw new Error("FORBIDDEN");
  }
}

export default DashboardService;
