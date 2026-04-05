import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const reviews = await prisma.review.findMany({
      where: { workbookId: id },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Reviews GET error:", error);
    return NextResponse.json(
      { error: "후기를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const { rating, content } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "평점은 1~5 사이여야 합니다." },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "후기 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    // Check if user has completed this workbook
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        userId: user.id,
        workbookId: id,
        quizType: "workbook",
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "문제집을 풀어본 후에 후기를 작성할 수 있습니다." },
        { status: 403 }
      );
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        workbookId: id,
        rating,
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Reviews POST error:", error);
    return NextResponse.json(
      { error: "후기 작성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
