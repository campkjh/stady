import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const oxQuizSet = await prisma.oxQuizSet.findUnique({
      where: { id },
      include: {
        category: true,
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!oxQuizSet) {
      return NextResponse.json(
        { error: "OX 퀴즈를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ oxQuizSet });
  } catch (error) {
    console.error("OX Quiz detail error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈 정보를 가져오는 중 오류가 발생했습니다." },
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

    const oxQuizSet = await prisma.oxQuizSet.update({
      where: { id },
      data: { isPopular: body.isPopular },
    });

    return NextResponse.json({ oxQuizSet });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("OX Quiz PATCH error:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
