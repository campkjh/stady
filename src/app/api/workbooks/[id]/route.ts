import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workbook = await prisma.workbook.findUnique({
      where: { id },
      include: {
        category: true,
        problems: { orderBy: { order: "asc" } },
      },
    });

    if (!workbook) {
      return NextResponse.json(
        { error: "문제집을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Build ranking: best attempt per user, sorted by score desc then timeTaken asc
    const attempts = await prisma.quizAttempt.findMany({
      where: { workbookId: id, quizType: "workbook" },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
      orderBy: [{ score: "desc" }, { timeTaken: "asc" }],
    });

    // Group by userId, keep best attempt per user
    const bestByUser = new Map<
      string,
      { userId: string; nickname: string; avatar: string | null; score: number; totalScore: number; timeTaken: number }
    >();

    for (const attempt of attempts) {
      const existing = bestByUser.get(attempt.userId);
      if (
        !existing ||
        attempt.score > existing.score ||
        (attempt.score === existing.score && attempt.timeTaken < existing.timeTaken)
      ) {
        bestByUser.set(attempt.userId, {
          userId: attempt.user.id,
          nickname: attempt.user.nickname,
          avatar: attempt.user.avatar,
          score: attempt.score,
          totalScore: attempt.totalScore,
          timeTaken: attempt.timeTaken,
        });
      }
    }

    const ranking = Array.from(bestByUser.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeTaken - b.timeTaken;
    });

    return NextResponse.json({ workbook, ranking });
  } catch (error) {
    console.error("Workbook detail error:", error);
    return NextResponse.json(
      { error: "문제집 정보를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const workbook = await prisma.workbook.update({
      where: { id },
      data: { isPopular: body.isPopular },
    });

    return NextResponse.json({ workbook });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Workbook PATCH error:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
