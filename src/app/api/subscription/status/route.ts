import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlan, getSubscription } from "@/lib/subscriptions";

const DEFAULT_PLAN = "monthly-pass";

// Reports the current user's subscription state for a plan so the mypage UI can
// show 구독하기 vs. 구독중 / 해지하기.
export async function GET(request: NextRequest) {
  try {
    const planId = request.nextUrl.searchParams.get("planId") || DEFAULT_PLAN;
    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, subscription: null, plan });
    }

    const sub = await getSubscription(user.id, planId);
    const now = Date.now();
    const periodEnd = sub ? new Date(sub.current_period_end).getTime() : 0;
    // Access is granted while ACTIVE, or after cancellation until the period ends.
    const active = !!sub && (sub.status === "ACTIVE" || (sub.status === "CANCELED" && periodEnd > now));

    return NextResponse.json({
      authenticated: true,
      plan,
      subscription: sub
        ? {
            status: sub.status,
            active,
            amount: Number(sub.amount),
            cardCompany: sub.card_company,
            cardNumber: sub.card_number,
            currentPeriodEnd: sub.current_period_end,
            nextBillingAt: sub.next_billing_at,
          }
        : null,
    });
  } catch (error) {
    console.error("subscription status error:", error);
    return NextResponse.json({ error: "상태를 확인하지 못했습니다." }, { status: 500 });
  }
}
