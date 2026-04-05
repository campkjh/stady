import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) where.title = { contains: search };

    const workbooks = await prisma.workbook.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workbooks });
  } catch (error) {
    console.error("Workbooks GET error:", error);
    return NextResponse.json(
      { error: "문제집을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { title, thumbnail, categoryId, totalQuestions, questionPerPage } = body;

    if (!title || !categoryId) {
      return NextResponse.json(
        { error: "제목과 카테고리는 필수입니다." },
        { status: 400 }
      );
    }

    const workbook = await prisma.workbook.create({
      data: {
        title,
        thumbnail,
        categoryId,
        totalQuestions: totalQuestions || 0,
        questionPerPage: questionPerPage || 12,
      },
      include: { category: true },
    });

    return NextResponse.json({ workbook }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("Workbooks POST error:", error);
    return NextResponse.json(
      { error: "문제집 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
