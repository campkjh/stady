import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activateSubscription, getPlan } from "@/lib/subscriptions";

// Called from the billing-auth success redirect. Issues a billingKey from the
// authKey, charges the first cycle, and stores the subscription.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const authKey = String(body.authKey || "");
    const customerKey = String(body.customerKey || "");
    const planId = String(body.planId || "");

    if (!authKey || !customerKey) {
      return NextResponse.json({ error: "잘못된 결제 정보입니다." }, { status: 400 });
    }
    if (customerKey !== user.id) {
      return NextResponse.json({ error: "본인 인증 정보가 아닙니다." }, { status: 403 });
    }
    if (!getPlan(planId)) {
      return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
    }

    try {
      const sub = await activateSubscription({ userId: user.id, planId, authKey, customerKey });
      return NextResponse.json({
        ok: true,
        nextBillingAt: sub?.next_billing_at ?? null,
        cardCompany: sub?.card_company ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "구독 처리에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("subscription confirm error:", error);
    return NextResponse.json({ error: "구독 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
