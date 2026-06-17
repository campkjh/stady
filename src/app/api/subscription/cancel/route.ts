import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelSubscription, getPlan } from "@/lib/subscriptions";

const DEFAULT_PLAN = "monthly-pass";

// Cancels auto-renewal. The user keeps access until current_period_end; no
// further charges are made.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planId = String(body.planId || DEFAULT_PLAN);
    if (!getPlan(planId)) {
      return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
    }

    await cancelSubscription(user.id, planId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("subscription cancel error:", error);
    return NextResponse.json({ error: "구독 해지 중 오류가 발생했습니다." }, { status: 500 });
  }
}
