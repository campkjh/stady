import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";
import { grade, resetAnswers } from "@/lib/mockExamQuestion";

export const dynamic = "force-dynamic";

// POST: 채점. 정답은 이 응답에만 담긴다(풀기 전에 내려가면 답이 새어 나간다).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    if (!(await viewerHasPremiumAccess())) {
      return NextResponse.json({ error: "프리미엄 구독이 필요한 콘텐츠예요.", premiumRequired: true }, { status: 403 });
    }
    return NextResponse.json(await grade(user.id, id));
  } catch (error) {
    console.error("Mock exam grade error:", error);
    return NextResponse.json({ error: "채점하지 못했습니다." }, { status: 500 });
  }
}

// DELETE: 답안 초기화(다시 풀기)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    if (!(await viewerHasPremiumAccess())) {
      return NextResponse.json({ error: "프리미엄 구독이 필요한 콘텐츠예요.", premiumRequired: true }, { status: 403 });
    }
    await resetAnswers(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mock exam reset error:", error);
    return NextResponse.json({ error: "초기화하지 못했습니다." }, { status: 500 });
  }
}
