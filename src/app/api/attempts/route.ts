import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get("attemptId");

    if (attemptId) {
      const attempt = await prisma.quizAttempt.findFirst({
        where: { id: attemptId, userId: user.id },
        include: {
          workbook: { select: { id: true, title: true, thumbnail: true } },
          problemAnswers: {
            include: {
              problem: {
                select: {
                  id: true, order: true, questionText: true, passageImage: true,
                  questionImage: true, answer: true, explanation: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({
        attempt,
        answers: attempt.problemAnswers,
      });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: {
        workbook: { select: { id: true, title: true, thumbnail: true } },
        oxQuizSet: { select: { id: true, title: true, thumbnail: true } },
        vocabQuizSet: { select: { id: true, title: true, thumbnail: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    return NextResponse.json({ attempts });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Attempts GET error:", error);
    return NextResponse.json(
      { error: "퀴즈 기록을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
