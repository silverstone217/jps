import { Prisma } from "@/app/generated/prisma/client";
import { cloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

import type {
  CreateProductInput,
  ProductData,
  ProductVariantData,
  UpdateProductInput,
} from "./product.schema";

// ======================================================
// TYPES PRISMA
// ======================================================

const productSelect = {
  id: true,
  shopId: true,
  name: true,
  description: true,
  image: true,
  recipeId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,

  variants: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      productId: true,
      packagingId: true,
      sku: true,
      price: true,
      shelfLifeDays: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

// ======================================================
// HELPERS
// ======================================================

function mapProductVariant(variant: {
  id: string;
  productId: string;
  packagingId: string;
  sku: string;
  price: Prisma.Decimal;
  shelfLifeDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductVariantData {
  return {
    id: variant.id,
    productId: variant.productId,
    packagingId: variant.packagingId,
    sku: Number(variant.price) >= 0 ? variant.sku : variant.sku,
    price: Number(variant.price),
    shelfLifeDays: variant.shelfLifeDays,
    isActive: variant.isActive,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

function mapProduct(
  product: Prisma.ProductGetPayload<{
    select: typeof productSelect;
  }>,
): ProductData {
  return {
    id: product.id,
    shopId: product.shopId,
    name: product.name,
    description: product.description,
    image: product.image,
    recipeId: product.recipeId,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),

    variants: product.variants.map(mapProductVariant),
  };
}

// ======================================================
// SHOP
// ======================================================

const MAIN_SHOP_SINGLETON = "MAIN";

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: MAIN_SHOP_SINGLETON,
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

// ======================================================
// VALIDATION DES VARIANTES
// ======================================================

async function validateVariantInputs(
  shopId: string,
  variants: Array<{
    packagingId: string;
    sku: string;
    price: number;
    shelfLifeDays: number;
    isActive?: boolean;
    id?: string;
  }>,
) {
  if (variants.length === 0) {
    throw new Error("PRODUCT_VARIANT_REQUIRED");
  }

  if (variants.length > 2) {
    throw new Error("TOO_MANY_PRODUCT_VARIANTS");
  }

  const packagingIds = variants.map((variant) => variant.packagingId);

  if (new Set(packagingIds).size !== packagingIds.length) {
    throw new Error("DUPLICATE_PRODUCT_PACKAGING");
  }

  const skus = variants.map((variant) => variant.sku.toUpperCase());

  if (new Set(skus).size !== skus.length) {
    throw new Error("DUPLICATE_PRODUCT_SKU");
  }

  const packagings = await prisma.packaging.findMany({
    where: {
      id: {
        in: packagingIds,
      },
      shopId,
    },
    select: {
      id: true,
      name: true,
      size: true,
      capacityMl: true,
      isActive: true,
    },
  });

  if (packagings.length !== packagingIds.length) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  const packagingMap = new Map(
    packagings.map((packaging) => [packaging.id, packaging]),
  );

  const selectedSizes = new Set<string>();

  for (const variant of variants) {
    const packaging = packagingMap.get(variant.packagingId);

    if (!packaging) {
      throw new Error("PACKAGING_NOT_FOUND");
    }

    if (!packaging.isActive) {
      throw new Error("PACKAGING_INACTIVE");
    }

    /*
     * Un produit ne peut avoir qu'une variante
     * par format.
     *
     * Le format réel vient du Packaging.size.
     */
    if (selectedSizes.has(packaging.size)) {
      throw new Error("DUPLICATE_PRODUCT_VARIANT_SIZE");
    }

    selectedSizes.add(packaging.size);
  }

  return packagingMap;
}

// ======================================================
// VÉRIFIER LES SKU
// ======================================================

async function ensureSkusAvailable(
  skus: string[],
  excludeVariantIds: string[] = [],
) {
  const normalizedSkus = skus.map((sku) => sku.toUpperCase());

  const existing = await prisma.productVariant.findMany({
    where: {
      sku: {
        in: normalizedSkus,
      },
      ...(excludeVariantIds.length > 0
        ? {
            id: {
              notIn: excludeVariantIds,
            },
          }
        : {}),
    },
    select: {
      id: true,
      sku: true,
    },
  });

  if (existing.length > 0) {
    throw new Error("SKU_ALREADY_EXISTS");
  }
}

// ======================================================
// VÉRIFIER UNE RECETTE
// ======================================================

async function validateRecipe(shopId: string, recipeId?: string) {
  if (!recipeId) {
    return null;
  }

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      shopId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!recipe) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  return recipe;
}

// ======================================================
// RÉCUPÉRER TOUS LES PRODUITS
// ======================================================

export async function getProducts(): Promise<ProductData[]> {
  const shop = await getMainShop();

  const products = await prisma.product.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: productSelect,
  });

  return products.map(mapProduct);
}

// ======================================================
// RÉCUPÉRER LES PRODUITS ACTIFS
// ======================================================

export async function getActiveProducts(): Promise<ProductData[]> {
  const shop = await getMainShop();

  const products = await prisma.product.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: productSelect,
  });

  return products.map(mapProduct);
}

// ======================================================
// RÉCUPÉRER UN PRODUIT
// ======================================================

export async function getProductById(productId: string): Promise<ProductData> {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: productSelect,
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return mapProduct(product);
}

// ======================================================
// CRÉER UN PRODUIT + SES VARIANTES
// ======================================================

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductData> {
  const shop = await getMainShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: input.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existingProduct) {
    throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
  }

  await validateRecipe(shop.id, input.recipeId || undefined);

  await validateVariantInputs(shop.id, input.variants);

  await ensureSkusAvailable(input.variants.map((variant) => variant.sku));

  const product = await prisma.$transaction(async (tx) => {
    const createdProduct = await tx.product.create({
      data: {
        shopId: shop.id,
        name: input.name,
        description: input.description || null,
        recipeId: input.recipeId || null,
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
      },
    });

    await tx.productVariant.createMany({
      data: input.variants.map((variant) => ({
        productId: createdProduct.id,
        packagingId: variant.packagingId,
        sku: variant.sku.toUpperCase(),
        price: new Prisma.Decimal(variant.price),
        shelfLifeDays: variant.shelfLifeDays ?? 2,
        isActive: variant.isActive ?? true,
      })),
    });

    return tx.product.findUniqueOrThrow({
      where: {
        id: createdProduct.id,
      },
      select: productSelect,
    });
  });

  return mapProduct(product);
}

// ======================================================
// VÉRIFIER SI UNE VARIANTE POSSÈDE DE L'HISTORIQUE
// ======================================================

async function variantHasHistory(variantId: string): Promise<boolean> {
  const [stock, saleItems, productionItems, transfers, losses] =
    await Promise.all([
      prisma.finishedStock.count({
        where: {
          variantId,
        },
      }),

      prisma.saleItem.count({
        where: {
          variantId,
        },
      }),

      prisma.productionItem.count({
        where: {
          variantId,
        },
      }),

      prisma.stockTransferItem.count({
        where: {
          variantId,
        },
      }),

      prisma.loss.count({
        where: {
          variantId,
        },
      }),
    ]);

  return (
    stock > 0 ||
    saleItems > 0 ||
    productionItems > 0 ||
    transfers > 0 ||
    losses > 0
  );
}

// ======================================================
// MODIFIER UN PRODUIT + SES VARIANTES
// ======================================================

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<ProductData> {
  const shop = await getMainShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: {
      id: true,
      name: true,
      image: true,
      variants: {
        select: {
          id: true,
          packagingId: true,
          sku: true,
          price: true,
          shelfLifeDays: true,
          isActive: true,
        },
      },
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const duplicateName = await prisma.product.findFirst({
    where: {
      shopId: shop.id,
      id: {
        not: productId,
      },
      name: {
        equals: input.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicateName) {
    throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
  }

  await validateRecipe(shop.id, input.recipeId || undefined);

  await validateVariantInputs(shop.id, input.variants);

  /*
   * Seuls les IDs présents dans la requête
   * sont considérés comme les variantes que
   * le produit doit conserver.
   */
  const incomingVariantIds = input.variants
    .map((variant) => variant.id)
    .filter((id): id is string => Boolean(id));

  /*
   * Vérifier que les IDs envoyés appartiennent
   * réellement à ce produit.
   */
  for (const variantId of incomingVariantIds) {
    const belongsToProduct = existingProduct.variants.some(
      (variant) => variant.id === variantId,
    );

    if (!belongsToProduct) {
      throw new Error("PRODUCT_VARIANT_NOT_FOUND");
    }
  }

  /*
   * Les variantes conservées ne doivent pas
   * avoir le même SKU qu'une autre variante
   * existante.
   */
  await ensureSkusAvailable(
    input.variants.map((variant) => variant.sku),
    incomingVariantIds,
  );

  /*
   * Vérifier les variantes retirées.
   */
  const incomingIdsSet = new Set(incomingVariantIds);

  const removedVariants = existingProduct.variants.filter(
    (variant) => !incomingIdsSet.has(variant.id),
  );

  const variantsToDeactivate: string[] = [];
  const variantsToDelete: string[] = [];

  for (const variant of removedVariants) {
    const hasHistory = await variantHasHistory(variant.id);

    if (hasHistory) {
      variantsToDeactivate.push(variant.id);
    } else {
      variantsToDelete.push(variant.id);
    }
  }

  const product = await prisma.$transaction(async (tx) => {
    /*
     * Mise à jour du produit.
     */
    await tx.product.update({
      where: {
        id: productId,
      },
      data: {
        name: input.name,
        description: input.description || null,
        recipeId: input.recipeId || null,
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
            }
          : {}),
      },
    });

    /*
     * Mise à jour ou création des variantes.
     */
    for (const variant of input.variants) {
      if (variant.id) {
        await tx.productVariant.update({
          where: {
            id: variant.id,
          },
          data: {
            packagingId: variant.packagingId,
            sku: variant.sku.toUpperCase(),
            price: new Prisma.Decimal(variant.price),
            shelfLifeDays: variant.shelfLifeDays ?? 2,
            isActive: variant.isActive ?? true,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId,
            packagingId: variant.packagingId,
            sku: variant.sku.toUpperCase(),
            price: new Prisma.Decimal(variant.price),
            shelfLifeDays: variant.shelfLifeDays ?? 2,
            isActive: variant.isActive ?? true,
          },
        });
      }
    }

    /*
     * Variante retirée mais ayant de l'historique :
     * on la conserve et on la désactive.
     */
    if (variantsToDeactivate.length > 0) {
      await tx.productVariant.updateMany({
        where: {
          id: {
            in: variantsToDeactivate,
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    /*
     * Variante retirée et sans historique :
     * suppression physique possible.
     */
    if (variantsToDelete.length > 0) {
      await tx.productVariant.deleteMany({
        where: {
          id: {
            in: variantsToDelete,
          },
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: {
        id: productId,
      },
      select: productSelect,
    });
  });

  return mapProduct(product);
}

// ======================================================
// SUPPRIMER UN PRODUIT
// ======================================================

export async function deleteProduct(productId: string): Promise<{
  product: ProductData;
  deactivated: boolean;
}> {
  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: productSelect,
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const variants = product.variants;

  let hasHistory = false;

  for (const variant of variants) {
    const history = await variantHasHistory(variant.id);

    if (history) {
      hasHistory = true;
      break;
    }
  }

  // ======================================================
  // PRODUIT AVEC HISTORIQUE
  // ======================================================

  if (hasHistory) {
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        isActive: false,
      },
      select: productSelect,
    });

    return {
      product: mapProduct(updatedProduct),
      deactivated: true,
    };
  }

  // ======================================================
  // SUPPRESSION RÉELLE
  // ======================================================

  const deletedProduct = await prisma.$transaction(async (tx) => {
    await tx.productVariant.deleteMany({
      where: {
        productId,
      },
    });

    return tx.product.delete({
      where: {
        id: productId,
      },
      select: productSelect,
    });
  });

  // ======================================================
  // SUPPRESSION IMAGE CLOUDINARY
  // ======================================================

  if (product.image) {
    const publicId = getCloudinaryPublicId(product.image);

    if (publicId) {
      try {
        await deleteCloudinaryImage(publicId);
      } catch (error) {
        console.error(
          "Erreur suppression image Cloudinary après suppression du produit:",
          error,
        );
      }
    }
  }

  return {
    product: mapProduct(deletedProduct),
    deactivated: false,
  };
}
// ======================================================
// CLOUDINARY — UPLOAD
// ======================================================

function uploadToCloudinary(
  buffer: Buffer,
  productId: string,
): Promise<{
  secure_url: string;
  public_id: string;
}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `jardin-pro/products/${productId}`,
        resource_type: "image",

        transformation: [
          {
            width: 800,
            height: 800,
            crop: "fill",
            gravity: "auto",
          },
          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
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
}

// ======================================================
// CLOUDINARY — PUBLIC ID
// ======================================================

function getCloudinaryPublicId(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);

    const segments = url.pathname.split("/").filter(Boolean);

    const uploadIndex = segments.findIndex((segment) => segment === "upload");

    if (uploadIndex === -1) {
      return null;
    }

    let publicIdSegments = segments.slice(uploadIndex + 1);

    /*
     * Supprimer les transformations Cloudinary
     * situées avant le public_id.
     *
     * Exemple :
     * /upload/c_fill,w_800,h_800/v123/...
     */
    const versionIndex = publicIdSegments.findIndex((segment) =>
      /^v\d+$/.test(segment),
    );

    if (versionIndex >= 0) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1);
    } else {
      /*
       * Si aucune version n'est présente,
       * retirer les éventuelles transformations.
       */
      while (publicIdSegments.length > 0 && publicIdSegments[0].includes(",")) {
        publicIdSegments = publicIdSegments.slice(1);
      }
    }

    if (publicIdSegments.length === 0) {
      return null;
    }

    const lastIndex = publicIdSegments.length - 1;

    publicIdSegments[lastIndex] = publicIdSegments[lastIndex].replace(
      /\.[^/.]+$/,
      "",
    );

    return publicIdSegments.join("/");
  } catch {
    return null;
  }
}

// ======================================================
// CLOUDINARY — DELETE
// ======================================================

function deleteCloudinaryImage(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (result?.result === "not found") {
          resolve();
          return;
        }

        resolve();
      },
    );
  });
}

// ======================================================
// AJOUTER / REMPLACER L'IMAGE
// ======================================================

export async function updateProductImage(
  productId: string,
  buffer: Buffer,
): Promise<ProductData> {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /*
   * On upload d'abord la nouvelle image.
   */
  const uploaded = await uploadToCloudinary(buffer, product.id);

  try {
    /*
     * Puis on enregistre sa nouvelle URL.
     */
    const updated = await prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        image: uploaded.secure_url,
      },
      select: productSelect,
    });

    /*
     * Seulement après succès DB,
     * on supprime l'ancienne image.
     */
    if (product.image) {
      const oldPublicId = getCloudinaryPublicId(product.image);

      if (oldPublicId) {
        try {
          await deleteCloudinaryImage(oldPublicId);
        } catch (error) {
          console.error(
            "Erreur suppression ancienne image Cloudinary :",
            error,
          );
        }
      }
    }

    return mapProduct(updated);
  } catch (error) {
    /*
     * Si la DB échoue, on supprime la nouvelle
     * image pour éviter une image orpheline.
     */
    try {
      await deleteCloudinaryImage(uploaded.public_id);
    } catch (cleanupError) {
      console.error("Erreur nettoyage image Cloudinary :", cleanupError);
    }

    throw error;
  }
}

// ======================================================
// SUPPRIMER L'IMAGE
// ======================================================

export async function removeProductImage(
  productId: string,
): Promise<ProductData> {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  if (!product.image) {
    const current = await prisma.product.findUniqueOrThrow({
      where: {
        id: product.id,
      },
      select: productSelect,
    });

    return mapProduct(current);
  }

  /*
   * On retire d'abord la référence en DB.
   * Le produit ne dépend donc plus d'une image
   * qui pourrait ne plus exister.
   */
  const updated = await prisma.product.update({
    where: {
      id: product.id,
    },
    data: {
      image: null,
    },
    select: productSelect,
  });

  /*
   * Ensuite on nettoie Cloudinary.
   */
  const publicId = getCloudinaryPublicId(product.image);

  if (publicId) {
    try {
      await deleteCloudinaryImage(publicId);
    } catch (error) {
      /*
       * La DB est déjà correcte.
       * On journalise simplement le problème
       * Cloudinary pour éviter de faire échouer
       * la suppression logique de l'image.
       */
      console.error("Erreur suppression image Cloudinary :", error);
    }
  }

  return mapProduct(updated);
}
