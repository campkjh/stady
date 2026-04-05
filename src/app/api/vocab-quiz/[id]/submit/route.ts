import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { answers, timeTaken } = await request.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "답안을 제출해주세요." },
        { status: 400 }
      );
    }

    const vocabQuizSet = await prisma.vocabQuizSet.findUnique({
      where: { id },
      include: { questions: true },
    });

    if (!vocabQuizSet) {
      return NextResponse.json(
        { error: "단어 퀴즈를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const questionMap = new Map(
      vocabQuizSet.questions.map((q) => [q.id, q.answer])
    );

    let score = 0;
    const answerData: { questionId: string; selected: number | null; isCorrect: boolean }[] = [];
    const wrongQuestionIds: string[] = [];

    for (const ans of answers as { questionId: string; selected: number | null }[]) {
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
          quizType: "vocab",
          vocabQuizSetId: id,
          score,
          totalScore: vocabQuizSet.questions.length,
          timeTaken: timeTaken || 0,
          vocabAnswers: {
            create: answerData,
          },
        },
        include: { vocabAnswers: true },
      });

      // Auto-bookmark wrong answers
      if (wrongQuestionIds.length > 0) {
        for (const questionId of wrongQuestionIds) {
          const existing = await tx.bookmark.findFirst({
            where: {
              userId: user.id,
              quizType: "vocab",
              vocabQuestionId: questionId,
            },
          });
          if (!existing) {
            await tx.bookmark.create({
              data: {
                userId: user.id,
                quizType: "vocab",
                vocabQuizSetId: id,
                vocabQuestionId: questionId,
              },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json({ attempt, score, totalScore: vocabQuizSet.questions.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Vocab Quiz submit error:", error);
    return NextResponse.json(
      { error: "제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
