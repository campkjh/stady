import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/subscriptions";

// Returns what the client needs to open the Toss billing-auth (card registration)
// window for a subscription plan. customerKey is the user id (stable per user).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const plan = getPlan(body.planId);
    if (!plan) {
      return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
    }

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json({ error: "결제 설정이 완료되지 않았습니다." }, { status: 500 });
    }

    return NextResponse.json({
      clientKey,
      customerKey: user.id,
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      customerEmail: user.email,
      customerName: user.nickname,
    });
  } catch (error) {
    console.error("subscription checkout error:", error);
    return NextResponse.json({ error: "구독 준비 중 오류가 발생했습니다." }, { status: 500 });
  }
}
