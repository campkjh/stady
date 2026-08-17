import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureInitialWorkbookDataRemoved } from "@/lib/workbook-cleanup";
import { isMasterAdminEmail } from "@/lib/auth";
import { computeSetAnswerRates } from "@/lib/oxAnswerRate";
import HomeClient, { type HomeMockExam } from "@/components/HomeClient";
import { listMockExams } from "@/lib/mockExam";
import { findSubject } from "@/lib/examSubjects";

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

  const oxQuizSetsWithRate = oxQuizSets.map((s) => ({ ...s, answerRate: setRates.get(s.id) ?? null }));

  // 홈 모의고사 섹션(티저 12개). 최근에 올린 회차를 먼저 보여주되, 한 회차 안에서는
  // 목록 화면과 같은 과목 순서(sort_order)를 지킨다. 등록 시각만으로 정렬하면 24과목이
  // 초 단위로 들어가 과목 순서가 뒤집히고 홈에 과탐만 깔린다.
  const examDay = (d: Date) => d.toISOString().slice(0, 10);
  const mockExams: HomeMockExam[] = [...mockExamsRaw]
    .sort((a, b) =>
      examDay(a.createdAt) === examDay(b.createdAt)
        ? a.sortOrder - b.sortOrder
        : examDay(b.createdAt).localeCompare(examDay(a.createdAt))
    )
    .slice(0, 12)
    .map((e) => {
      const hit = findSubject(e.subject);
      return {
        id: e.id,
        title: e.title,
        subtitle: e.subtitle,
        coverUrl: e.imageUrls[0] ?? null,
        pageCount: e.imageUrls.length,
        hasSolution: e.solutionImageUrls.length > 0,
        subjectLabel: hit?.subject.label ?? null,
        subjectIcon: hit?.group.icon ?? null,
      };
    });

  return (
    <HomeClient
      userName={user?.nickname ?? null}
      isAdmin={isAdmin}
      categories={categories}
      workbooks={workbooks}
      oxQuizSets={oxQuizSetsWithRate}
      vocabQuizSets={vocabQuizSets}
      mockExams={mockExams}
    />
  );
}
