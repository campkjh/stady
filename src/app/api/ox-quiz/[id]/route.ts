import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
