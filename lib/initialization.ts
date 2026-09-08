import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

export async function initializeApp() {
  console.log("🔄 Initialisation de Jardin Pro...");

  // ============================================================
  // 1. MANAGER INITIAL
  // ============================================================

  const hashedPassword = await bcrypt.hash("admin01", 12);

  const manager = await prisma.user.upsert({
    where: {
      telephone: "0123456789",
    },

    update: {},

    create: {
      name: "admin",
      telephone: "0123456789",
      email: "admin@maill.com",
      password: hashedPassword,
      role: "MANAGER",
      isActive: true,
      isBanned: false,
    },
  });

  console.log("✅ Manager initialisé :", manager.telephone);

  // ============================================================
  // 2. BOUTIQUE PRINCIPALE
  // ============================================================

  const shop = await prisma.shop.upsert({
    where: {
      singleton: "MAIN",
    },

    update: {},

    create: {
      singleton: "MAIN",
      name: "Jus Jardin",
      slogan: "le gout du jus frais au naturel",
      email: "jusjardin@email.com",
      address: "142/A, av. Colonel Mondjiba, Q/ basoko. C/ Ngaliema",
      telephone: "0825563646",
      currency: "CDF",
      ownerId: manager.id,
    },
  });

  console.log("✅ Boutique initialisée :", shop.name);

  console.log("✅ Initialisation de Jardin Pro terminée.");
}

// telephone: "0825563646",
