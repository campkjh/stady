import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const questions = await prisma.oxQuestion.findMany({
      where: { oxQuizSetId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("OX Questions GET error:", error);
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
    const { question, answer, explanation } = body;

    if (!question || answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "질문과 정답은 필수입니다." },
        { status: 400 }
      );
    }

    const lastQuestion = await prisma.oxQuestion.findFirst({
      where: { oxQuizSetId: id },
      orderBy: { order: "desc" },
    });

    const order = lastQuestion ? lastQuestion.order + 1 : 1;

    const oxQuestion = await prisma.oxQuestion.create({
      data: {
        oxQuizSetId: id,
        order,
        question,
        answer: Boolean(answer),
        explanation: explanation || null,
      },
    });

    await prisma.oxQuizSet.update({
      where: { id },
      data: { totalQuestions: { increment: 1 } },
    });

    return NextResponse.json({ question: oxQuestion }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("OX Questions POST error:", error);
    return NextResponse.json(
      { error: "질문 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
