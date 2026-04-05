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

    const workbook = await prisma.workbook.findUnique({
      where: { id },
      include: { problems: true },
    });

    if (!workbook) {
      return NextResponse.json(
        { error: "문제집을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Build a map of problemId -> correct answer
    const problemMap = new Map(
      workbook.problems.map((p) => [p.id, p.answer])
    );

    // Score each answer
    let score = 0;
    const answerData: { problemId: string; selected: number | null; isCorrect: boolean }[] = [];
    const wrongProblemIds: string[] = [];

    for (const ans of answers as { problemId: string; selected: number | null }[]) {
      const correctAnswer = problemMap.get(ans.problemId);
      const isCorrect = correctAnswer !== undefined && ans.selected === correctAnswer;
      if (isCorrect) score++;
      else wrongProblemIds.push(ans.problemId);

      answerData.push({
        problemId: ans.problemId,
        selected: ans.selected ?? null,
        isCorrect,
      });
    }

    // Create attempt with answers in a transaction
    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          userId: user.id,
          quizType: "workbook",
          workbookId: id,
          score,
          totalScore: workbook.problems.length,
          timeTaken: timeTaken || 0,
          problemAnswers: {
            create: answerData,
          },
        },
        include: { problemAnswers: true },
      });

      // Auto-bookmark wrong answers
      if (wrongProblemIds.length > 0) {
        for (const problemId of wrongProblemIds) {
          const existing = await tx.bookmark.findFirst({
            where: {
              userId: user.id,
              quizType: "workbook",
              problemId,
            },
          });
          if (!existing) {
            await tx.bookmark.create({
              data: {
                userId: user.id,
                quizType: "workbook",
                workbookId: id,
                problemId,
              },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json({ attempt, score, totalScore: workbook.problems.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Workbook submit error:", error);
    return NextResponse.json(
      { error: "제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
