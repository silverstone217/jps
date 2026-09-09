import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  /**
   * Vérification de l'ancien mot de passe.
   */
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!isCurrentPasswordValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  /**
   * Le nouveau mot de passe doit être différent
   * de l'ancien.
   */
  if (currentPassword === newPassword) {
    throw new Error("PASSWORD_SAME_AS_CURRENT");
  }

  /**
   * Sécurité supplémentaire côté service.
   * Le schema Zod vérifie déjà cette règle,
   * mais le service ne doit pas dépendre uniquement
   * de la validation de la route.
   */
  if (newPassword.length < 6 || newPassword.length > 12) {
    throw new Error("INVALID_NEW_PASSWORD");
  }

  /**
   * Hash du nouveau mot de passe.
   */
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  /**
   * Mise à jour du mot de passe.
   */
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      password: hashedPassword,
    },
  });
};
