import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

import type { UpdateProfileInput } from "./profile.schema";

// ============================================================
// PROFILE SELECT
// ============================================================

export const profileSelect = {
  id: true,
  email: true,
  name: true,
  telephone: true,
  image: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================================
// UPDATE PROFILE
// ============================================================

export const updateProfile = async (
  userId: string,
  data: UpdateProfileInput,
) => {
  // ============================================================
  // VÉRIFIER QUE L'UTILISATEUR EXISTE
  // ============================================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      telephone: true,
      isActive: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // ============================================================
  // VÉRIFIER L'EMAIL
  // ============================================================

  const email = data.email?.trim() || null;

  if (email !== existingUser.email) {
    if (email) {
      const emailExists = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (emailExists && emailExists.id !== userId) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }
  }

  // ============================================================
  // VÉRIFIER LE TÉLÉPHONE
  // ============================================================

  if (data.telephone !== existingUser.telephone) {
    const telephoneExists = await prisma.user.findUnique({
      where: {
        telephone: data.telephone,
      },
      select: {
        id: true,
      },
    });

    if (telephoneExists && telephoneExists.id !== userId) {
      throw new Error("TELEPHONE_ALREADY_EXISTS");
    }
  }

  // ============================================================
  // MODIFIER LE PROFIL
  // ============================================================

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: data.name.trim(),
      telephone: data.telephone,
      email,

      ...(data.isActive !== undefined && {
        isActive: data.isActive,
      }),
    },
    select: profileSelect,
  });

  return updatedUser;
};

// ============================================================
// EXTRAIRE LE PUBLIC ID CLOUDINARY DEPUIS L'URL
// ============================================================

const getCloudinaryPublicId = (imageUrl: string): string | null => {
  try {
    const url = new URL(imageUrl);

    const uploadMarker = "/upload/";

    const uploadIndex = url.pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    let path = url.pathname.slice(uploadIndex + uploadMarker.length);

    const segments = path.split("/");

    // Retirer les transformations Cloudinary.
    //
    // Exemple :
    // /upload/c_fill,w_500,h_500,q_auto,f_auto/v123456/
    //
    // On cherche le segment de version "v123456".
    const versionIndex = segments.findIndex((segment) =>
      /^v\d+$/.test(segment),
    );

    if (versionIndex !== -1) {
      path = segments.slice(versionIndex + 1).join("/");
    }

    // Retirer l'extension du fichier
    path = path.replace(/\.[^/.]+$/, "");

    return path || null;
  } catch {
    return null;
  }
};

// ============================================================
// UPLOAD IMAGE CLOUDINARY
// ============================================================

const uploadImageToCloudinary = async (
  file: Buffer,
  userId: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `jardin-pro/users/${userId}`,
        resource_type: "image",

        transformation: [
          {
            width: 500,
            height: 500,
            crop: "fill",
            gravity: "face",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("CLOUDINARY_UPLOAD_FAILED"));
          return;
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(file);
  });
};

// ============================================================
// SUPPRIMER IMAGE CLOUDINARY
// ============================================================

const deleteImageFromCloudinary = async (imageUrl: string): Promise<void> => {
  const publicId = getCloudinaryPublicId(imageUrl);

  if (!publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
};

// ============================================================
// MODIFIER L'IMAGE DU PROFIL
// ============================================================

export const updateProfileImage = async (userId: string, file: Buffer) => {
  // ============================================================
  // VÉRIFIER QUE L'UTILISATEUR EXISTE
  // ============================================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // ============================================================
  // UPLOAD DE LA NOUVELLE IMAGE
  // ============================================================

  const newImage = await uploadImageToCloudinary(file, userId);

  try {
    // ==========================================================
    // ENREGISTRER LA NOUVELLE URL
    // ==========================================================

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        image: newImage,
      },
      select: profileSelect,
    });

    // ==========================================================
    // SUPPRIMER L'ANCIENNE IMAGE
    // ==========================================================

    if (existingUser.image) {
      try {
        await deleteImageFromCloudinary(existingUser.image);
      } catch (error) {
        console.error(
          "Erreur lors de la suppression de l'ancienne image Cloudinary:",
          error,
        );
      }
    }

    return updatedUser;
  } catch (error) {
    // ==========================================================
    // SI LA DB ÉCHOUE, SUPPRIMER LA NOUVELLE IMAGE
    // ==========================================================

    try {
      await deleteImageFromCloudinary(newImage);
    } catch (deleteError) {
      console.error(
        "Erreur lors de la suppression de la nouvelle image Cloudinary:",
        deleteError,
      );
    }

    throw error;
  }
};

// ============================================================
// SUPPRIMER L'IMAGE DU PROFIL
// ============================================================

export const removeProfileImage = async (userId: string) => {
  // ============================================================
  // VÉRIFIER QUE L'UTILISATEUR EXISTE
  // ============================================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // ============================================================
  // SUPPRIMER L'IMAGE CLOUDINARY
  // ============================================================

  if (existingUser.image) {
    await deleteImageFromCloudinary(existingUser.image);
  }

  // ============================================================
  // SUPPRIMER L'URL DE LA DB
  // ============================================================

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      image: null,
    },
    select: profileSelect,
  });

  return updatedUser;
};

// ============================================================
// GET PROFILE
// ============================================================

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: profileSelect,
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return user;
};
