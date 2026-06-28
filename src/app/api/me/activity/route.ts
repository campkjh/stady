import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserActivityScore, tierForScore, TIER_THRESHOLDS } from "@/lib/community";

// 현재 사용자의 활동 경험치(점수) + 등급 + 다음 등급까지 진행 정보.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const score = await getUserActivityScore(user.id);
    const tier = tierForScore(score);
    const idx = TIER_THRESHOLDS.findIndex((t) => t.tier === tier);
    const current = TIER_THRESHOLDS[idx];
    const next = TIER_THRESHOLDS[idx + 1] ?? null;
    return NextResponse.json({
      score,
      tier,
      currentMin: current?.min ?? 0,
      nextTier: next?.tier ?? null,
      nextMin: next?.min ?? null,
    });
  } catch (error) {
    console.error("me/activity GET error:", error);
    return NextResponse.json({ error: "활동 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
