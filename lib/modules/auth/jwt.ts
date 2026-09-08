import jwt from "jsonwebtoken";
import type { Role } from "@/app/generated/prisma/client";
import { JWT_SECRET } from "@/utils/envVariables";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export type JwtPayload = {
  userId: string;
  role: Role;
};

export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "30d",
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid token");
  }

  if (
    typeof decoded.userId !== "string" ||
    (decoded.role !== "MANAGER" && decoded.role !== "EMPLOYEE")
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as Role,
  };
}
