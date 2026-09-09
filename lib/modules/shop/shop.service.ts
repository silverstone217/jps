import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

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
      throw new Error("SHOP_NOT_FOUND");
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
      throw new Error("SHOP_NOT_FOUND");
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
   *
   * L'image reçue en Buffer est envoyée à Cloudinary.
   * Seule l'URL sécurisée Cloudinary est enregistrée dans la base.
   */
  static async updateShopLogo(userId: string, buffer: Buffer) {
    const existingShop = await prisma.shop.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!existingShop) {
      throw new Error("SHOP_NOT_FOUND");
    }

    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `jardin-pro/shops/${userId}`,
          resource_type: "image",
          transformation: [
            {
              width: 500,
              height: 500,
              crop: "fill",
              gravity: "auto",
            },
          ],
          quality: "auto",
          fetch_format: "auto",
        },
        (error, result) => {
          if (error || !result) {
            console.error("Cloudinary shop logo upload error:", error);

            reject(new Error("CLOUDINARY_UPLOAD_FAILED"));

            return;
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });

    /**
     * Enregistrer uniquement l'URL Cloudinary dans PostgreSQL.
     */
    const shop = await prisma.shop.update({
      where: {
        ownerId: userId,
      },
      data: {
        logo: uploadResult.secure_url,
      },
    });

    /**
     * Supprimer l'ancien logo de Cloudinary après
     * la mise à jour réussie de la base de données.
     */
    if (existingShop.logo) {
      try {
        const oldLogoUrl = existingShop.logo;

        const uploadIndex = oldLogoUrl.indexOf("/upload/");

        if (uploadIndex !== -1) {
          let publicId = oldLogoUrl.substring(uploadIndex + "/upload/".length);

          /**
           * Supprimer les transformations et la version.
           */
          publicId = publicId.replace(/^v\d+\//, "");

          publicId = publicId.replace(/\.[^/.]+$/, "");

          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true,
          });
        }
      } catch (error) {
        /**
         * La suppression de l'ancien logo ne doit pas
         * faire échouer la modification déjà enregistrée.
         */
        console.error("Cloudinary old shop logo deletion error:", error);
      }
    }

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
      throw new Error("SHOP_NOT_FOUND");
    }

    /**
     * Supprimer le fichier de Cloudinary avant
     * de supprimer son URL de la base.
     */
    if (existingShop.logo) {
      try {
        const logoUrl = existingShop.logo;

        const uploadIndex = logoUrl.indexOf("/upload/");

        if (uploadIndex !== -1) {
          let publicId = logoUrl.substring(uploadIndex + "/upload/".length);

          publicId = publicId.replace(/^v\d+\//, "");

          publicId = publicId.replace(/\.[^/.]+$/, "");

          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true,
          });
        }
      } catch (error) {
        console.error("Cloudinary shop logo deletion error:", error);
      }
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
