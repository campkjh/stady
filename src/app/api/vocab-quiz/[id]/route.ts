import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vocabQuizSet = await prisma.vocabQuizSet.findUnique({
      where: { id },
      include: {
        category: true,
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!vocabQuizSet) {
      return NextResponse.json(
        { error: "단어 퀴즈를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ vocabQuizSet });
  } catch (error) {
    console.error("Vocab Quiz detail error:", error);
    return NextResponse.json(
      { error: "단어 퀴즈 정보를 가져오는 중 오류가 발생했습니다." },
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

    const data: Record<string, unknown> = {};
    if (body.isPopular !== undefined) data.isPopular = body.isPopular;
    if (body.title !== undefined) data.title = body.title;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.difficulty !== undefined) data.difficulty = body.difficulty;
    if (body.totalQuestions !== undefined) data.totalQuestions = body.totalQuestions;
    if (body.thumbnail !== undefined) data.thumbnail = body.thumbnail;

    const vocabQuizSet = await prisma.vocabQuizSet.update({ where: { id }, data });
    return NextResponse.json({ vocabQuizSet });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Vocab Quiz PATCH error:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.$transaction([
      prisma.vocabAnswer.deleteMany({ where: { question: { vocabQuizSetId: id } } }),
      prisma.vocabQuestion.deleteMany({ where: { vocabQuizSetId: id } }),
      prisma.bookmark.deleteMany({ where: { vocabQuizSetId: id } }),
      prisma.quizAttempt.deleteMany({ where: { vocabQuizSetId: id } }),
      prisma.vocabQuizSet.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Vocab Quiz DELETE error:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
