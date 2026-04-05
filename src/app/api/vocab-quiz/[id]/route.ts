import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vocabQuizSet = await prisma.vocabQuizSet.findUnique({
      where: { id },
      include: {
        category: true,
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!vocabQuizSet) {
      return NextResponse.json(
        { error: "단어 퀴즈를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ vocabQuizSet });
  } catch (error) {
    console.error("Vocab Quiz detail error:", error);
    return NextResponse.json(
      { error: "단어 퀴즈 정보를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
