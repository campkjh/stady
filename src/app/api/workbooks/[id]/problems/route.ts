import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const problems = await prisma.problem.findMany({
      where: { workbookId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ problems });
  } catch (error) {
    console.error("Problems GET error:", error);
    return NextResponse.json(
      { error: "문제를 가져오는 중 오류가 발생했습니다." },
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
    const {
      questionText,
      questionImage,
      passageImage,
      choicesImage,
      choice1,
      choice2,
      choice3,
      choice4,
      choice5,
      answer,
      explanation,
    } = body;

    if (!questionText && !questionImage && !passageImage) {
      return NextResponse.json(
        { error: "문제 이미지 또는 텍스트를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!answer) {
      return NextResponse.json(
        { error: "정답을 선택해주세요." },
        { status: 400 }
      );
    }

    // choicesImage 모드: 선택지를 하나의 이미지로 등록
    // choice1에 이미지 URL, choice2~4는 "_" 마커
    const finalChoice1 = choicesImage || choice1 || "";
    const finalChoice2 = choicesImage ? "_" : (choice2 || "");
    const finalChoice3 = choicesImage ? "_" : (choice3 || "");
    const finalChoice4 = choicesImage ? "_" : (choice4 || "");
    const finalChoice5 = choicesImage ? "_" : (choice5 || "");

    if (!choicesImage && (!finalChoice1 || !finalChoice2 || !finalChoice3 || !finalChoice4)) {
      return NextResponse.json(
        { error: "선택지를 입력해주세요." },
        { status: 400 }
      );
    }

    const lastProblem = await prisma.problem.findFirst({
      where: { workbookId: id },
      orderBy: { order: "desc" },
    });

    const order = lastProblem ? lastProblem.order + 1 : 1;

    const problem = await prisma.problem.create({
      data: {
        workbookId: id,
        order,
        questionText: questionText || null,
        questionImage: questionImage || null,
        passageImage: passageImage || null,
        choice1: finalChoice1,
        choice2: finalChoice2,
        choice3: finalChoice3,
        choice4: finalChoice4,
        choice5: finalChoice5,
        answer,
        explanation: explanation || null,
      },
    });

    await prisma.workbook.update({
      where: { id },
      data: { totalQuestions: { increment: 1 } },
    });

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("Problems POST error:", error);
    return NextResponse.json(
      { error: "문제 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
