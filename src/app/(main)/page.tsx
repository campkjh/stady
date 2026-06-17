import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureInitialWorkbookDataRemoved } from "@/lib/workbook-cleanup";
import { isMasterAdminEmail } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  await ensureInitialWorkbookDataRemoved();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  const [user, categoriesRaw, workbooks, oxQuizSets, vocabQuizSets] = await Promise.all([
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { email: true, nickname: true, role: true, signupSource: true } })
      : null,
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.workbook.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.oxQuizSet.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vocabQuizSet.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const categories = categoriesRaw.filter((c) => c.name !== "전체");
  const isNewUser = cookieStore.get("isNewUser")?.value !== undefined && !user?.signupSource;
  const isAdmin = user?.role === "admin" || isMasterAdminEmail(user?.email);

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      isAdmin={isAdmin}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSets}
      vocabQuizSets={vocabQuizSets}
      isNewUser={isNewUser}
    />
  );
}
