import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const questions = await prisma.vocabQuestion.findMany({
      where: { vocabQuizSetId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Vocab Questions GET error:", error);
    return NextResponse.json(
      { error: "질문을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { word, choice1, choice2, choice3, choice4, answer, explanation } = body;

    if (!word || !choice1 || !choice2 || !choice3 || !choice4 || !answer) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const lastQuestion = await prisma.vocabQuestion.findFirst({
      where: { vocabQuizSetId: id },
      orderBy: { order: "desc" },
    });

    const order = lastQuestion ? lastQuestion.order + 1 : 1;

    const vocabQuestion = await prisma.vocabQuestion.create({
      data: {
        vocabQuizSetId: id,
        order,
        word,
        choice1,
        choice2,
        choice3,
        choice4,
        answer,
        explanation: explanation || null,
      },
    });

    await prisma.vocabQuizSet.update({
      where: { id },
      data: { totalQuestions: { increment: 1 } },
    });

    return NextResponse.json({ question: vocabQuestion }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("Vocab Questions POST error:", error);
    return NextResponse.json(
      { error: "질문 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
