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
  isActive: true,
  createdAt: true,
  updatedAt: true,

  recipe: {
    select: {
      id: true,
      productId: true,
      name: true,
      description: true,
      productionVolumeMl: true,
      createdAt: true,
      updatedAt: true,

      items: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          recipeId: true,
          ingredientId: true,
          quantity: true,
        },
      },
    },
  },

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
    sku: variant.sku,
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
    isActive: product.isActive,

    recipe: product.recipe
      ? {
          id: product.recipe.id,
          productId: product.recipe.productId,
          name: product.recipe.name,
          description: product.recipe.description,
          productionVolumeMl: product.recipe.productionVolumeMl,
          createdAt: product.recipe.createdAt.toISOString(),
          updatedAt: product.recipe.updatedAt.toISOString(),

          items: product.recipe.items.map((item) => ({
            id: item.id,
            recipeId: item.recipeId,
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
          })),
        }
      : null,

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

    // Un produit ne peut avoir qu'une variante
    // par format.
    //
    // Le format réel vient du Packaging.size.

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
// CRÉER UN PRODUIT + SES VARIANTES + SA RECETTE
// ======================================================

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductData> {
  const shop = await getMainShop();

  // ----------------------------------------------------
  // Vérifier le nom du produit
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // Vérifier les variantes
  // ----------------------------------------------------

  await validateVariantInputs(shop.id, input.variants);

  await ensureSkusAvailable(input.variants.map((variant) => variant.sku));

  // ----------------------------------------------------
  // Création
  // ----------------------------------------------------

  const product = await prisma.$transaction(async (tx) => {
    // ----------------------------------------------
    // Produit
    // ----------------------------------------------

    const createdProduct = await tx.product.create({
      data: {
        shopId: shop.id,

        name: input.name,

        description: input.description || null,

        isActive: input.isActive ?? true,
      },

      select: {
        id: true,
      },
    });

    // ----------------------------------------------
    // Recette
    //
    // IMPORTANT :
    // Recipe appartient maintenant au Product.
    // ----------------------------------------------

    if (input.recipe) {
      await tx.recipe.create({
        data: {
          productId: createdProduct.id,

          name: input.recipe.name,

          description: input.recipe.description || null,

          productionVolumeMl: input.recipe.productionVolumeMl,

          items: {
            create: input.recipe.items.map((item) => ({
              ingredientId: item.ingredientId,

              quantity: new Prisma.Decimal(item.quantity),
            })),
          },
        },
      });
    }

    // ----------------------------------------------
    // Variantes
    // ----------------------------------------------

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

    // ----------------------------------------------
    // Récupérer le produit complet
    // ----------------------------------------------

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
// MODIFIER UN PRODUIT + SES VARIANTES + SA RECETTE
// ======================================================

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<ProductData> {
  const shop = await getMainShop();

  // ----------------------------------------------------
  // Produit existant
  // ----------------------------------------------------

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },

    select: {
      id: true,
      name: true,
      image: true,

      recipe: {
        select: {
          id: true,
        },
      },

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

  // ----------------------------------------------------
  // Vérifier le nom
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // Vérifier les variantes
  // ----------------------------------------------------

  await validateVariantInputs(shop.id, input.variants);

  // ----------------------------------------------------
  // IDs des variantes reçues
  // ----------------------------------------------------

  const incomingVariantIds = input.variants
    .map((variant) => variant.id)
    .filter((id): id is string => Boolean(id));

  // ----------------------------------------------------
  // Vérifier que les variantes appartiennent
  // réellement au produit
  // ----------------------------------------------------

  for (const variantId of incomingVariantIds) {
    const belongsToProduct = existingProduct.variants.some(
      (variant) => variant.id === variantId,
    );

    if (!belongsToProduct) {
      throw new Error("PRODUCT_VARIANT_NOT_FOUND");
    }
  }

  // ----------------------------------------------------
  // Vérifier les SKU
  // ----------------------------------------------------

  await ensureSkusAvailable(
    input.variants.map((variant) => variant.sku),
    incomingVariantIds,
  );

  // ----------------------------------------------------
  // Vérifier les variantes retirées
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // TRANSACTION
  // ----------------------------------------------------

  const product = await prisma.$transaction(async (tx) => {
    // ----------------------------------------------
    // Mise à jour du produit
    // ----------------------------------------------

    await tx.product.update({
      where: {
        id: productId,
      },

      data: {
        name: input.name,

        description: input.description || null,

        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
            }
          : {}),
      },
    });

    // ----------------------------------------------
    // Gestion de la recette
    // ----------------------------------------------

    if (input.recipe) {
      // --------------------------------------------
      // Si le produit possède déjà une recette
      // --------------------------------------------

      if (existingProduct.recipe) {
        // Supprimer les anciens items.
        //
        // Les RecipeItem appartiennent à la
        // recette et peuvent donc être recréés
        // proprement.

        await tx.recipeItem.deleteMany({
          where: {
            recipeId: existingProduct.recipe.id,
          },
        });

        // Mettre à jour la recette.

        await tx.recipe.update({
          where: {
            id: existingProduct.recipe.id,
          },

          data: {
            name: input.recipe.name,

            description: input.recipe.description || null,

            productionVolumeMl: input.recipe.productionVolumeMl,

            items: {
              create: input.recipe.items.map((item) => ({
                ingredientId: item.ingredientId,

                quantity: new Prisma.Decimal(item.quantity),
              })),
            },
          },
        });
      } else {
        // ------------------------------------------
        // Le produit n'avait pas encore de recette
        // ------------------------------------------

        await tx.recipe.create({
          data: {
            productId,

            name: input.recipe.name,

            description: input.recipe.description || null,

            productionVolumeMl: input.recipe.productionVolumeMl,

            items: {
              create: input.recipe.items.map((item) => ({
                ingredientId: item.ingredientId,

                quantity: new Prisma.Decimal(item.quantity),
              })),
            },
          },
        });
      }
    } else {
      // --------------------------------------------
      // Aucune recette envoyée
      //
      // Si une recette existe déjà, on la conserve.
      //
      // Cela évite qu'une modification du produit
      // supprime accidentellement sa recette.
      // --------------------------------------------
    }

    // ----------------------------------------------
    // Mise à jour / création des variantes
    // ----------------------------------------------

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

    // ----------------------------------------------
    // Variantes avec historique
    // ----------------------------------------------

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

    // ----------------------------------------------
    // Variantes sans historique
    // ----------------------------------------------

    if (variantsToDelete.length > 0) {
      await tx.productVariant.deleteMany({
        where: {
          id: {
            in: variantsToDelete,
          },
        },
      });
    }

    // ----------------------------------------------
    // Produit complet
    // ----------------------------------------------

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
    // Les variantes ont des relations historiques
    // en Restrict. On les supprime donc d'abord.

    await tx.productVariant.deleteMany({
      where: {
        productId,
      },
    });

    // Ici :
    //
    // Product est supprimé
    //       ↓
    // Recipe est supprimée automatiquement
    //       ↓
    // RecipeItem est supprimé automatiquement
    //
    // grâce aux relations :
    //
    // Recipe.productId -> Product.id
    // onDelete: Cascade
    //
    // RecipeItem.recipeId -> Recipe.id
    // onDelete: Cascade

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

    // Supprimer les transformations
    // Cloudinary situées avant le public_id.

    const versionIndex = publicIdSegments.findIndex((segment) =>
      /^v\d+$/.test(segment),
    );

    if (versionIndex >= 0) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1);
    } else {
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

  // Upload d'abord la nouvelle image.

  const uploaded = await uploadToCloudinary(buffer, product.id);

  try {
    // Enregistrer la nouvelle URL en DB.

    const updated = await prisma.product.update({
      where: {
        id: product.id,
      },

      data: {
        image: uploaded.secure_url,
      },

      select: productSelect,
    });

    // DB OK → supprimer l'ancienne image.

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
    // DB échouée → supprimer la nouvelle
    // image pour éviter une image orpheline.

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

  // Retirer d'abord la référence DB.

  const updated = await prisma.product.update({
    where: {
      id: product.id,
    },

    data: {
      image: null,
    },

    select: productSelect,
  });

  // Puis nettoyer Cloudinary.

  const publicId = getCloudinaryPublicId(product.image);

  if (publicId) {
    try {
      await deleteCloudinaryImage(publicId);
    } catch (error) {
      console.error("Erreur suppression image Cloudinary :", error);
    }
  }

  return mapProduct(updated);
}
