import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureInitialWorkbookDataRemoved } from "@/lib/workbook-cleanup";
import { isMasterAdminEmail } from "@/lib/auth";
import { isPremium } from "@/lib/iap/entitlements";
import { computeSetAnswerRates } from "@/lib/oxAnswerRate";
import { getLockedOxSetIds } from "@/lib/premiumGate";
import HomeClient from "@/components/HomeClient";
import { type BrowserExam } from "@/components/MockExamBrowser";
import { listMockExams } from "@/lib/mockExam";
import { yearOptions } from "@/lib/examSubjects";
import { examIdsWithQuestions } from "@/lib/mockExamQuestion";

export default async function HomePage() {
  await ensureInitialWorkbookDataRemoved();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  const [user, categoriesRaw, workbooks, oxQuizSets, vocabQuizSets, setRates, mockExamsRaw] = await Promise.all([
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
    listMockExams(true),
  ]);

  const categories = categoriesRaw.filter((c) => c.name !== "전체");
  const isAdmin = user?.role === "admin" || isMasterAdminEmail(user?.email);

  // 프리미엄 접근 여부 + 잠금 OX 세트 — 홈의 모의고사/생윤·윤사 카드 잠금 표시용.
  const [isPremiumUser, lockedOxIds] = await Promise.all([
    isAdmin ? Promise.resolve(true) : userId ? isPremium(userId).catch(() => false) : Promise.resolve(false),
    getLockedOxSetIds().catch(() => new Set<string>()),
  ]);

  const oxQuizSetsWithRate = oxQuizSets.map((s) => ({
    ...s,
    answerRate: setRates.get(s.id) ?? null,
    isPremium: lockedOxIds.has(s.id),
  }));

  // 홈 모의고사 섹션은 목록 화면과 같은 분류 탭을 쓰므로 전체를 넘긴다(필터가 골라낸다).
  // 카드 순서는 최근 회차 먼저, 한 회차 안에서는 목록 화면과 같은 과목 순서(sort_order).
  // 등록 시각만으로 정렬하면 24과목이 초 단위로 들어간 탓에 과목 순서가 뒤집힌다.
  const examDay = (d: Date) => d.toISOString().slice(0, 10);
  const withQuestions = await examIdsWithQuestions(mockExamsRaw.map((e) => e.id));
  const mockExams: BrowserExam[] = [...mockExamsRaw]
    .sort((a, b) =>
      examDay(a.createdAt) === examDay(b.createdAt)
        ? a.sortOrder - b.sortOrder
        : examDay(b.createdAt).localeCompare(examDay(a.createdAt))
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      subtitle: e.subtitle,
      coverUrl: e.imageUrls[0] ?? null,
      pageCount: e.imageUrls.length,
      solutionCount: e.solutionImageUrls.length,
      year: e.year,
      month: e.month,
      subject: e.subject,
      hasQuestions: withQuestions.has(e.id),
    }));
  const mockExamYears = yearOptions(
    mockExamsRaw.map((e) => e.year).filter((y): y is number => typeof y === "number")
  );

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      isAdmin={isAdmin}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSetsWithRate}
      vocabQuizSets={vocabQuizSets}
      mockExams={mockExams}
      mockExamYears={mockExamYears}
      isPremiumUser={isPremiumUser}
    />
  );
}
