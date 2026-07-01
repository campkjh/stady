import { NextRequest, NextResponse } from "next/server";
import { getMockExam } from "@/lib/mockExam";

// 공개: 모의고사 단건(이미지 포함).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const exam = await getMockExam(id);
    if (!exam || !exam.isActive) {
      return NextResponse.json({ error: "모의고사를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ exam });
  } catch (error) {
    console.error("Mock exam GET error:", error);
    return NextResponse.json({ error: "불러오지 못했습니다." }, { status: 500 });
  }
}
