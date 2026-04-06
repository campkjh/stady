import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  const [user, categoriesRaw, workbooks, oxQuizSets, vocabQuizSets] = await Promise.all([
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } })
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
  const isNewUser = cookieStore.get("isNewUser")?.value !== undefined;

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSets}
      vocabQuizSets={vocabQuizSets}
      isNewUser={isNewUser}
    />
  );
}
