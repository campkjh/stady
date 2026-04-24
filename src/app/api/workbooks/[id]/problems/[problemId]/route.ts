import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; problemId: string }> }
) {
  try {
    await requireAdmin();
    const { problemId } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.questionImage !== undefined) data.questionImage = body.questionImage;
    if (body.passageImage !== undefined) data.passageImage = body.passageImage;
    if (body.questionText !== undefined) data.questionText = body.questionText;
    if (body.choice1 !== undefined) data.choice1 = body.choice1;
    if (body.choice2 !== undefined) data.choice2 = body.choice2;
    if (body.choice3 !== undefined) data.choice3 = body.choice3;
    if (body.choice4 !== undefined) data.choice4 = body.choice4;
    if (body.choice5 !== undefined) data.choice5 = body.choice5;
    if (body.answer !== undefined) data.answer = body.answer;
    if (body.explanation !== undefined) data.explanation = body.explanation;

    const problem = await prisma.problem.update({ where: { id: problemId }, data });
    return NextResponse.json({ problem });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Problem PATCH error:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; problemId: string }> }
) {
  try {
    await requireAdmin();
    const { id, problemId } = await params;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { workbookId: true },
    });

    if (!problem) {
      return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.problemAnswer.deleteMany({ where: { problemId } }),
      prisma.bookmark.deleteMany({ where: { problemId } }),
      prisma.problem.delete({ where: { id: problemId } }),
    ]);

    // Update workbook total
    const count = await prisma.problem.count({ where: { workbookId: id } });
    await prisma.workbook.update({ where: { id }, data: { totalQuestions: count } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Problem DELETE error:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
