import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/modules/auth/jwt";

import type { LoginInput } from "./auth.schema";

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      telephone: input.telephone,
    },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.isActive || user.isBanned) {
    throw new Error("ACCOUNT_DISABLED");
  }

  const passwordIsValid = await bcrypt.compare(input.password, user.password);

  if (!passwordIsValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = createToken({
    userId: user.id,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      telephone: user.telephone,
      email: user.email,
      image: user.image,
      role: user.role,
    },
  };
}
