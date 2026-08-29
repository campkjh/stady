import { NextRequest, NextResponse } from "next/server";
import { getMockExam } from "@/lib/mockExam";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";

// 모의고사는 전부 프리미엄 전용(단건 상세).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await viewerHasPremiumAccess())) {
      return NextResponse.json({ error: "프리미엄 구독이 필요한 콘텐츠예요.", premiumRequired: true }, { status: 403 });
    }
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
