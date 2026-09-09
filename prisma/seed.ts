import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🔄 Initialisation de la base de données Jardin Pro...");

  // ============================================================
  // 1. MANAGER INITIAL
  // ============================================================

  let manager = await prisma.user.findFirst({
    where: {
      role: "MANAGER",
    },
    orderBy: {
      createdAt: "asc",
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

    console.log("✅ Manager initial créé :", manager.telephone);
  } else {
    console.log(
      "✅ Manager déjà existant :",
      manager.name,
      `(${manager.telephone})`,
    );
  }

  // ============================================================
  // 2. BOUTIQUE PRINCIPALE
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
        slogan: "Le goût du jus frais au naturel",
        email: "jusjardin@email.com",
        address: "142/A, av. Colonel Mondjiba, Q/ Basoko. C/ Ngaliema",
        telephone: "0825563646",
        currency: "CDF",
        ownerId: manager.id,
      },
    });

    console.log("✅ Boutique principale créée :", shop.name);
  } else {
    console.log("✅ Boutique principale déjà existante :", existingShop.name);
  }

  console.log("✅ Initialisation de Jardin Pro terminée.");
}

main()
  .catch((error) => {
    console.error("❌ Erreur pendant le seed :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
