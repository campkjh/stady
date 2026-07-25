import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureInitialWorkbookDataRemoved } from "@/lib/workbook-cleanup";
import { isMasterAdminEmail } from "@/lib/auth";
import { computeSetAnswerRates } from "@/lib/oxAnswerRate";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  await ensureInitialWorkbookDataRemoved();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  const [user, categoriesRaw, workbooks, oxQuizSets, vocabQuizSets, setRates] = await Promise.all([
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
    // OX 세트별 정답률(사용자 응답 집계) — 홈 카드에 표시. 다른 쿼리와 병렬.
    computeSetAnswerRates(),
  ]);

  const categories = categoriesRaw.filter((c) => c.name !== "전체");
  const isAdmin = user?.role === "admin" || isMasterAdminEmail(user?.email);

  const oxQuizSetsWithRate = oxQuizSets.map((s) => ({ ...s, answerRate: setRates.get(s.id) ?? null }));

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      isAdmin={isAdmin}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSetsWithRate}
      vocabQuizSets={vocabQuizSets}
    />
  );
}
