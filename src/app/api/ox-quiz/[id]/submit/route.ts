import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isOxSetLocked, viewerHasPremiumAccess } from "@/lib/premiumGate";
import { ensureThinkerTables, getThinkerAnswerMap } from "@/lib/oxThinker";

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

    const { answers, timeTaken, thinkerAnswers } = await request.json();

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

    // 사상가 문제(객관식)는 OxAnswer 에 넣을 수 없다(questionId 가 OxQuestion FK) → 별도 테이블.
    const thinkerList = Array.isArray(thinkerAnswers)
      ? (thinkerAnswers as { questionId: string; selected: string | null }[])
      : [];
    const thinkerData: { questionId: string; selected: string | null; isCorrect: boolean }[] = [];
    if (thinkerList.length > 0) {
      const thinkerMap = await getThinkerAnswerMap(id);
      for (const ta of thinkerList) {
        const correct = thinkerMap.get(ta.questionId);
        const isCorrect = correct !== undefined && ta.selected === correct;
        if (isCorrect) score++;
        thinkerData.push({ questionId: ta.questionId, selected: ta.selected ?? null, isCorrect });
      }
    }

    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          userId: user.id,
          quizType: "ox",
          oxQuizSetId: id,
          score,
          totalScore: answerData.length + thinkerData.length,
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

      // 사상가 답안 기록(실패해도 채점 결과는 살린다)
      if (thinkerData.length > 0) {
        try {
          await ensureThinkerTables();
          for (const t of thinkerData) {
            await tx.$executeRawUnsafe(
              `INSERT INTO "OxThinkerAnswer" ("id","attempt_id","question_id","selected","is_correct")
               VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
              created.id,
              t.questionId,
              t.selected,
              t.isCorrect
            );
          }
        } catch (e) {
          console.error("사상가 답안 기록 실패:", e);
        }
      }

      return created;
    });

    // 상위 N% — 이 세트를 푼 사용자별 "최고 정답률"과 비교한 경쟁 백분위.
    // 나보다 정답률이 높은 사람 수 higher → 내 순위=higher+1 → 상위=round(순위/전체*100).
    const totalCount = answerData.length + thinkerData.length;
    const myFraction = totalCount > 0 ? score / totalCount : 0;
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

    return NextResponse.json({ attempt, score, totalScore: totalCount, topPercent });
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
