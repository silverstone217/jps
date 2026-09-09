import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "./employee.schema";

const DEFAULT_EMPLOYEE_PASSWORD = "employee01";

const employeeSelect = {
  id: true,
  name: true,
  email: true,
  telephone: true,
  image: true,
  role: true,
  isActive: true,
  isBanned: true,
  banExpiresAt: true,
  banReason: true,
  createdAt: true,
  updatedAt: true,

  assignments: {
    where: {
      isActive: true,
    },
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          isMainStore: true,
          isActive: true,
        },
      },
    },
  },
} as const;

const getShopByOwnerId = async (managerId: string) => {
  const shop = await prisma.shop.findUnique({
    where: {
      ownerId: managerId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

const getEmployeeForShop = async (employeeId: string, shopId: string) => {
  const employee = await prisma.user.findFirst({
    where: {
      id: employeeId,
      role: "EMPLOYEE",
      assignments: {
        some: {
          shopId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      role: true,
      isActive: true,

      assignments: {
        where: {
          shopId,
          isActive: true,
        },
        select: {
          id: true,
          pointOfSaleId: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  return employee;
};

const validatePointOfSale = async (
  pointOfSaleId: string | undefined,
  shopId: string,
) => {
  if (!pointOfSaleId) {
    return null;
  }

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  if (!pointOfSale.isActive) {
    throw new Error("POINT_OF_SALE_INACTIVE");
  }

  return pointOfSale;
};

const normalizeEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();

  return normalized || null;
};

/**
 * Récupérer tous les employés de la boutique
 * appartenant au manager connecté.
 */
export const getEmployees = async (managerId: string) => {
  // Vérifie simplement que le manager possède bien la boutique.
  await getShopByOwnerId(managerId);

  const employees = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: employeeSelect,
  });

  return employees;
};

/**
 * Récupérer un employé appartenant à la boutique
 * du manager connecté.
 */
export const getEmployee = async (managerId: string, employeeId: string) => {
  // Vérifie que le manager possède bien la boutique.
  await getShopByOwnerId(managerId);

  const employee = await prisma.user.findFirst({
    where: {
      id: employeeId,
      role: "EMPLOYEE",
    },
    select: employeeSelect,
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  return employee;
};

/**
 * Créer un nouvel employé.
 *
 * Le mot de passe initial est automatiquement :
 * employee01
 */
export const createEmployee = async (
  managerId: string,
  data: CreateEmployeeInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  const telephone = data.telephone.trim();
  const email = normalizeEmail(data.email);

  /**
   * Vérifier l'unicité du téléphone.
   */
  const existingTelephone = await prisma.user.findUnique({
    where: {
      telephone,
    },
    select: {
      id: true,
    },
  });

  if (existingTelephone) {
    throw new Error("EMPLOYEE_TELEPHONE_ALREADY_EXISTS");
  }

  /**
   * Vérifier l'unicité de l'email.
   */
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      throw new Error("EMPLOYEE_EMAIL_ALREADY_EXISTS");
    }
  }

  /**
   * Vérifier que le POS appartient bien
   * à la boutique du manager.
   */
  const pointOfSale = await validatePointOfSale(data.pointOfSaleId, shop.id);

  /**
   * Mot de passe initial automatique.
   */
  const hashedPassword = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 12);

  const employee = await prisma.$transaction(async (tx) => {
    /**
     * Création du compte utilisateur.
     */
    const createdEmployee = await tx.user.create({
      data: {
        name: data.name.trim(),
        telephone,
        email,
        password: hashedPassword,
        role: "EMPLOYEE",
        isActive: data.isActive ?? true,
        isBanned: false,
      },

      select: {
        id: true,
      },
    });

    /**
     * Affectation au POS si un POS a été fourni.
     */
    if (pointOfSale) {
      await tx.staffAssignment.create({
        data: {
          userId: createdEmployee.id,
          shopId: shop.id,
          pointOfSaleId: pointOfSale.id,
          isActive: true,
        },
      });
    }

    return createdEmployee;
  });

  /**
   * Retourner l'employé complet sans jamais
   * exposer le mot de passe.
   */
  return getEmployee(managerId, employee.id);
};

/**
 * Modifier un employé.
 *
 * Le mot de passe n'est jamais modifié ici.
 * L'employé le modifie depuis son espace Sécurité.
 */
export const updateEmployee = async (
  managerId: string,
  employeeId: string,
  data: UpdateEmployeeInput,
) => {
  const shop = await getShopByOwnerId(managerId);

  /**
   * Vérifier que l'employé appartient bien
   * à la boutique du manager.
   */
  await getEmployeeForShop(employeeId, shop.id);

  const telephone = data.telephone.trim();
  const email = normalizeEmail(data.email);

  /**
   * Vérifier que le téléphone n'est pas
   * déjà utilisé par un autre utilisateur.
   */
  const existingTelephone = await prisma.user.findFirst({
    where: {
      telephone,
      id: {
        not: employeeId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingTelephone) {
    throw new Error("EMPLOYEE_TELEPHONE_ALREADY_EXISTS");
  }

  /**
   * Vérifier que l'email n'est pas
   * déjà utilisé par un autre utilisateur.
   */
  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        id: {
          not: employeeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      throw new Error("EMPLOYEE_EMAIL_ALREADY_EXISTS");
    }
  }

  /**
   * Vérifier le nouveau POS.
   */
  const pointOfSale = await validatePointOfSale(data.pointOfSaleId, shop.id);

  await prisma.$transaction(async (tx) => {
    /**
     * Mise à jour des informations de l'employé.
     */
    await tx.user.update({
      where: {
        id: employeeId,
      },

      data: {
        name: data.name.trim(),
        telephone,
        email,
        isActive: data.isActive ?? true,
      },
    });

    /**
     * Récupérer l'affectation active actuelle.
     */
    const currentAssignment = await tx.staffAssignment.findFirst({
      where: {
        userId: employeeId,
        shopId: shop.id,
        isActive: true,
      },

      select: {
        id: true,
        pointOfSaleId: true,
      },
    });

    /**
     * Aucun POS sélectionné.
     *
     * On désactive simplement l'affectation actuelle
     * sans supprimer son historique.
     */
    if (!pointOfSale) {
      if (currentAssignment) {
        await tx.staffAssignment.update({
          where: {
            id: currentAssignment.id,
          },

          data: {
            isActive: false,
          },
        });
      }

      return;
    }

    /**
     * L'employé est déjà affecté à ce POS.
     * Aucune modification nécessaire.
     */
    if (
      currentAssignment &&
      currentAssignment.pointOfSaleId === pointOfSale.id
    ) {
      return;
    }

    /**
     * Désactiver l'ancienne affectation.
     */
    if (currentAssignment) {
      await tx.staffAssignment.update({
        where: {
          id: currentAssignment.id,
        },

        data: {
          isActive: false,
        },
      });
    }

    /**
     * Créer la nouvelle affectation.
     */
    await tx.staffAssignment.create({
      data: {
        userId: employeeId,
        shopId: shop.id,
        pointOfSaleId: pointOfSale.id,
        isActive: true,
      },
    });
  });

  return getEmployee(managerId, employeeId);
};

/**
 * Supprimer un employé.
 *
 * La suppression est refusée si l'employé
 * possède déjà un historique métier.
 */
export const deleteEmployee = async (managerId: string, employeeId: string) => {
  const shop = await getShopByOwnerId(managerId);

  const employee = await getEmployeeForShop(employeeId, shop.id);

  /**
   * Vérifier les ventes.
   */
  const hasSales = await prisma.sale.findFirst({
    where: {
      sellerId: employee.id,
    },

    select: {
      id: true,
    },
  });

  if (hasSales) {
    throw new Error("EMPLOYEE_HAS_RELATED_DATA");
  }

  /**
   * Vérifier les productions.
   */
  const hasProductions = await prisma.production.findFirst({
    where: {
      managerId: employee.id,
    },

    select: {
      id: true,
    },
  });

  if (hasProductions) {
    throw new Error("EMPLOYEE_HAS_RELATED_DATA");
  }

  /**
   * Vérifier les pertes.
   */
  const hasLosses = await prisma.loss.findFirst({
    where: {
      reportedById: employee.id,
    },

    select: {
      id: true,
    },
  });

  if (hasLosses) {
    throw new Error("EMPLOYEE_HAS_RELATED_DATA");
  }

  /**
   * Vérifier les transferts de stock.
   */
  const hasTransfers = await prisma.stockTransfer.findFirst({
    where: {
      createdById: employee.id,
    },

    select: {
      id: true,
    },
  });

  if (hasTransfers) {
    throw new Error("EMPLOYEE_HAS_RELATED_DATA");
  }

  /**
   * Suppression du compte.
   *
   * Les StaffAssignment associés seront supprimés
   * automatiquement grâce à onDelete: Cascade
   * sur User.assignments.
   */
  await prisma.user.delete({
    where: {
      id: employeeId,
    },
  });
};
