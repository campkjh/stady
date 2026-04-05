import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;

    const oxQuizSets = await prisma.oxQuizSet.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ oxQuizSets });
  } catch (error) {
    console.error("OX Quiz GET error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { title, thumbnail, categoryId, difficulty, totalQuestions } = body;

    if (!title || !categoryId) {
      return NextResponse.json(
        { error: "제목과 카테고리는 필수입니다." },
        { status: 400 }
      );
    }

    const oxQuizSet = await prisma.oxQuizSet.create({
      data: {
        title,
        thumbnail,
        categoryId,
        difficulty: difficulty || "보통",
        totalQuestions: totalQuestions || 0,
      },
      include: { category: true },
    });

    return NextResponse.json({ oxQuizSet }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("OX Quiz POST error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
