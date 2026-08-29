import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isOxSetLocked, viewerHasPremiumAccess } from "@/lib/premiumGate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // 프리미엄 잠금 세트는 채점·기록도 막는다.
    if ((await isOxSetLocked(id)) && !(await viewerHasPremiumAccess())) {
      return NextResponse.json(
        { error: "프리미엄 구독이 필요한 콘텐츠예요.", premiumRequired: true },
        { status: 403 }
      );
    }

    const { answers, timeTaken } = await request.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "답안을 제출해주세요." },
        { status: 400 }
      );
    }

    const oxQuizSet = await prisma.oxQuizSet.findUnique({
      where: { id },
      include: { questions: true },
    });

    if (!oxQuizSet) {
      return NextResponse.json(
        { error: "OX 퀴즈를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const questionMap = new Map(
      oxQuizSet.questions.map((q) => [q.id, q.answer])
    );

    let score = 0;
    const answerData: { questionId: string; selected: boolean | null; isCorrect: boolean }[] = [];
    const wrongQuestionIds: string[] = [];

    for (const ans of answers as { questionId: string; selected: boolean | null }[]) {
      const correctAnswer = questionMap.get(ans.questionId);
      const isCorrect = correctAnswer !== undefined && ans.selected === correctAnswer;
      if (isCorrect) score++;
      else wrongQuestionIds.push(ans.questionId);

      answerData.push({
        questionId: ans.questionId,
        selected: ans.selected ?? null,
        isCorrect,
      });
    }

    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          userId: user.id,
          quizType: "ox",
          oxQuizSetId: id,
          score,
          totalScore: answerData.length,
          timeTaken: timeTaken || 0,
          oxAnswers: {
            create: answerData,
          },
        },
        include: { oxAnswers: true },
      });

      // Auto-bookmark wrong answers
      if (wrongQuestionIds.length > 0) {
        for (const questionId of wrongQuestionIds) {
          const existing = await tx.bookmark.findFirst({
            where: {
              userId: user.id,
              quizType: "ox",
              oxQuestionId: questionId,
            },
          });
          if (!existing) {
            await tx.bookmark.create({
              data: {
                userId: user.id,
                quizType: "ox",
                oxQuizSetId: id,
                oxQuestionId: questionId,
              },
            });
          }
        }
      }

      return created;
    });

    // 상위 N% — 이 세트를 푼 사용자별 "최고 정답률"과 비교한 경쟁 백분위.
    // 나보다 정답률이 높은 사람 수 higher → 내 순위=higher+1 → 상위=round(순위/전체*100).
    const myFraction = answerData.length > 0 ? score / answerData.length : 0;
    let topPercent: number | null = null;
    try {
      const rank = await prisma.$queryRawUnsafe<{ total: bigint; higher: bigint }[]>(
        `WITH best AS (
           SELECT "userId", MAX("score"::float / NULLIF("totalScore", 0)) AS frac
           FROM "QuizAttempt"
           WHERE "oxQuizSetId" = $1 AND "quizType" = 'ox' AND "totalScore" > 0
           GROUP BY "userId"
         )
         SELECT (SELECT COUNT(*) FROM best) AS total,
                (SELECT COUNT(*) FROM best WHERE frac > $2) AS higher`,
        id,
        myFraction
      );
      const total = Number(rank[0]?.total || 0);
      const higher = Number(rank[0]?.higher || 0);
      if (total > 0) topPercent = Math.max(1, Math.round(((higher + 1) / total) * 100));
    } catch (e) {
      console.error("OX percentile error:", e);
    }

    return NextResponse.json({ attempt, score, totalScore: answerData.length, topPercent });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("OX Quiz submit error:", error);
    return NextResponse.json(
      { error: "제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
