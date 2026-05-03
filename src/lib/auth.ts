import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const MASTER_ADMIN_EMAIL = "campkjh@nate.com";

export function isMasterAdminEmail(email?: string | null) {
  return email?.toLowerCase() === MASTER_ADMIN_EMAIL;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (isMasterAdminEmail(user.email)) {
    return { ...user, role: "admin" };
  }
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}
