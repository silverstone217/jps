import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

export async function initializeApp() {
  console.log("🔄 Initialisation de Jardin Pro...");

  // ============================================================
  // 1. MANAGER
  // ============================================================

  let manager = await prisma.user.findFirst({
    where: {
      role: "MANAGER",
    },
  });

  if (!manager) {
    const hashedPassword = await bcrypt.hash("admin01", 12);

    manager = await prisma.user.create({
      data: {
        name: "admin",
        telephone: "0123456789",
        email: "admin@maill.com",
        password: hashedPassword,
        role: "MANAGER",
        isActive: true,
        isBanned: false,
      },
    });

    console.log("✅ Manager créé :", manager.telephone);
  } else {
    console.log("ℹ️ Manager déjà existant :", manager.telephone);
  }

  // ============================================================
  // 2. BOUTIQUE
  // ============================================================

  const existingShop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!existingShop) {
    const shop = await prisma.shop.create({
      data: {
        singleton: "MAIN",
        name: "Jus Jardin",
        slogan: "le gout du jus frais au naturel",
        email: "jusjardin@email.com",
        address: "142/A, av. Colonel Mondjiba, Q/ basoko. C/ Ngaliema",
        currency: "CDF",
        ownerId: manager.id,
        telephone: "0825563646",
      },
    });

    console.log("✅ Boutique créée :", shop.name);
  } else {
    console.log("ℹ️ Boutique déjà existante :", existingShop.name);
  }

  console.log("✅ Initialisation de Jardin Pro terminée.");
}
