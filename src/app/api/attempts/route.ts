import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

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
