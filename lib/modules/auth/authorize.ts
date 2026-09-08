import type { Role } from "@/app/generated/prisma/client";
import { verifyToken } from "@/lib/modules/auth/jwt";

export async function authorize(request: Request, allowedRoles: Role[]) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new Error("UNAUTHORIZED");
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    throw new Error("UNAUTHORIZED");
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  if (!allowedRoles.includes(payload.role)) {
    throw new Error("FORBIDDEN");
  }

  return payload;
}
