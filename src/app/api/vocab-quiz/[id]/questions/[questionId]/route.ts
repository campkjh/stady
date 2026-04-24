import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    await requireAdmin();
    const { questionId } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.word !== undefined) data.word = body.word;
    if (body.choice1 !== undefined) data.choice1 = body.choice1;
    if (body.choice2 !== undefined) data.choice2 = body.choice2;
    if (body.choice3 !== undefined) data.choice3 = body.choice3;
    if (body.choice4 !== undefined) data.choice4 = body.choice4;
    if (body.answer !== undefined) data.answer = body.answer;
    if (body.explanation !== undefined) data.explanation = body.explanation;

    const question = await prisma.vocabQuestion.update({ where: { id: questionId }, data });
    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Vocab Question PATCH error:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    await requireAdmin();
    const { id, questionId } = await params;

    await prisma.$transaction([
      prisma.vocabAnswer.deleteMany({ where: { questionId } }),
      prisma.bookmark.deleteMany({ where: { vocabQuestionId: questionId } }),
      prisma.vocabQuestion.delete({ where: { id: questionId } }),
    ]);

    const count = await prisma.vocabQuestion.count({ where: { vocabQuizSetId: id } });
    await prisma.vocabQuizSet.update({ where: { id }, data: { totalQuestions: count } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Vocab Question DELETE error:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
