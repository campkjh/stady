import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureInitialWorkbookDataRemoved } from "@/lib/workbook-cleanup";
import { isMasterAdminEmail } from "@/lib/auth";
import { isPremium } from "@/lib/iap/entitlements";
import { computeSetAnswerRates } from "@/lib/oxAnswerRate";
import { getLockedOxSetIds } from "@/lib/premiumGate";
import { getCsatOxSetIds } from "@/lib/csatPrep";
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

  // 홈의 과목 버튼은 그 과목의 '문제집' 목록으로 가는 입구다. 문제집이 없는 과목은
  // 눌러도 "등록된 문제집이 없습니다"만 나오므로, 문제집이 있는 과목만 띄운다.
  // (지금은 생활과윤리만 해당 — 사회문화·윤리와사상·통합사회는 자동으로 숨는다.
  //  나중에 그 과목에 문제집을 등록하면 따로 손대지 않아도 다시 나타난다.)
  const categoryIdsWithWorkbook = new Set(workbooks.map((w) => w.categoryId));
  const categories = categoriesRaw.filter(
    (c) => c.name !== "전체" && categoryIdsWithWorkbook.has(c.id)
  );
  const isAdmin = user?.role === "admin" || isMasterAdminEmail(user?.email);

  // 프리미엄 접근 여부 + 잠금 OX 세트 — 홈의 모의고사/생윤·윤사 카드 잠금 표시용.
  const [isPremiumUser, lockedOxIds, csatIds] = await Promise.all([
    isAdmin ? Promise.resolve(true) : userId ? isPremium(userId).catch(() => false) : Promise.resolve(false),
    getLockedOxSetIds().catch(() => new Set<string>()),
    getCsatOxSetIds(),
  ]);

  // 수능대비자료 세트는 홈 OX 카드·'새로운 퀴즈'에 섞지 않는다(수능대비자료 바로가기 안에서만).
  const oxQuizSetsWithRate = oxQuizSets.filter((s) => !csatIds.has(s.id)).map((s) => ({
    ...s,
    answerRate: setRates.get(s.id) ?? null,
    isPremium: lockedOxIds.has(s.id),
  }));

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      isAdmin={isAdmin}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSetsWithRate}
      vocabQuizSets={vocabQuizSets}
      isPremiumUser={isPremiumUser}
    />
  );
}
