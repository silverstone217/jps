import { prisma } from "@/lib/prisma";
import type { UpdateShopInput } from "./shop.schema";

export class ShopService {
  /**
   * Récupérer la boutique de l'utilisateur connecté.
   */
  static async getShop(userId: string) {
    const shop = await prisma.shop.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!shop) {
      const error = new Error("SHOP_NOT_FOUND");
      throw error;
    }

    return shop;
  }

  /**
   * Modifier les informations de la boutique.
   */
  static async updateShop(userId: string, data: UpdateShopInput) {
    const existingShop = await prisma.shop.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!existingShop) {
      const error = new Error("SHOP_NOT_FOUND");
      throw error;
    }

    const shop = await prisma.shop.update({
      where: {
        ownerId: userId,
      },
      data: {
        name: data.name,
        slogan: data.slogan || null,
        telephone: data.telephone,
        email: data.email || null,
        address: data.address,
        currency: data.currency,
      },
    });

    return shop;
  }

  /**
   * Mettre à jour le logo de la boutique.
   */
  static async updateShopLogo(userId: string, logoUrl: string) {
    const existingShop = await prisma.shop.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!existingShop) {
      const error = new Error("SHOP_NOT_FOUND");
      throw error;
    }

    const shop = await prisma.shop.update({
      where: {
        ownerId: userId,
      },
      data: {
        logo: logoUrl,
      },
    });

    return shop;
  }

  /**
   * Supprimer le logo de la boutique.
   */
  static async removeShopLogo(userId: string) {
    const existingShop = await prisma.shop.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!existingShop) {
      const error = new Error("SHOP_NOT_FOUND");
      throw error;
    }

    const shop = await prisma.shop.update({
      where: {
        ownerId: userId,
      },
      data: {
        logo: null,
      },
    });

    return shop;
  }
}

export default ShopService;
