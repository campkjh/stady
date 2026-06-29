import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const MASTER_ADMIN_EMAIL = "campkjh@nate.com";
export const ADMIN_EMAILS = [
  MASTER_ADMIN_EMAIL,
  "tlsdml0507@naver.com",
];

export function isMasterAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// 주어진 유저 id 중 관리자(ADMIN_EMAILS) 계정의 id 집합. 커뮤니티에서 관리자 프로필 표시용.
export async function getAdminUserIds(userIds: (string | null | undefined)[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Set();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  });
  return new Set(users.filter((u) => isMasterAdminEmail(u.email)).map((u) => u.id));
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
