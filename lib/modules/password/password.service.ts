import crypto from "crypto";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";
import EmailService from "@/lib/services/email.service";

import type {
  ChangePasswordInput,
  ForgotPasswordInput,
} from "./password.schema";

const TEMPORARY_PASSWORD_LENGTH = 6;

const PASSWORD_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export class PasswordService {
  private static generateTemporaryPassword(): string {
    let password = "";

    for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
      password +=
        PASSWORD_CHARACTERS[crypto.randomInt(0, PASSWORD_CHARACTERS.length)];
    }

    return password;
  }

  static async forgotPassword(data: ForgotPasswordInput): Promise<{
    email: string;
  }> {
    const email = data.email.trim().toLowerCase();
    const telephone = data.telephone.trim();

    const user = await prisma.user.findFirst({
      where: {
        email,
        telephone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!user.email) {
      throw new Error("EMAIL_NOT_FOUND");
    }

    if (!user.isActive) {
      throw new Error("ACCOUNT_INACTIVE");
    }

    if (user.isBanned) {
      throw new Error("ACCOUNT_BANNED");
    }

    // Génération du mot de passe temporaire
    const temporaryPassword = this.generateTemporaryPassword();

    // Hash du mot de passe avant stockage
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Remplacement du mot de passe actuel
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    // Envoi du mot de passe temporaire par email
    await EmailService.sendTemporaryPassword({
      email: user.email,
      name: user.name,
      temporaryPassword,
    });

    return {
      email: user.email,
    };
  }

  static async changePassword(
    userId: string,
    data: ChangePasswordInput,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        password: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!user.isActive) {
      throw new Error("ACCOUNT_INACTIVE");
    }

    if (user.isBanned) {
      throw new Error("ACCOUNT_BANNED");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      data.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });
  }
}

export default PasswordService;
