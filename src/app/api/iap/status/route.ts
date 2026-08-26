import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEntitlement } from "@/lib/iap/entitlements";
import { IAP_PLAN_LIST } from "@/lib/iap/plans";

export const dynamic = "force-dynamic";

// Reports the plan catalog + the current user's entitlement so the client can
// render the subscription UI and gate premium features. The client also uses the
// per-platform product ids here to trigger the native purchase.
export async function GET() {
  const plans = IAP_PLAN_LIST.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    priceKrw: p.priceKrw,
    period: p.period,
    monthlyEquivalentKrw: p.monthlyEquivalentKrw,
    discountPct: p.discountPct ?? null,
    badge: p.badge ?? null,
    recommended: !!p.recommended,
    productIds: p.productIds,
  }));

  // ⚠️ authenticated 는 "세션이 있는가" 만 답해야 한다. 예전엔 아래 두 조회를 한
  // try 로 묶어, 구독권 조회(DB)가 잠깐 실패하면 로그인한 사람에게도
  // authenticated:false 를 돌려줬다 — 그러면 결제 버튼이 "로그인이 필요하다"는
  // 에러를 띄우고 로그인 시트를 연다(App Review 2.1(b) 로 보이는 그 증상).
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("iap status: session lookup failed:", error);
    return NextResponse.json({ authenticated: false, entitlement: null, plans });
  }
  if (!user) {
    return NextResponse.json({ authenticated: false, entitlement: null, plans });
  }

  try {
    const entitlement = await getActiveEntitlement(user.id);
    return NextResponse.json({ authenticated: true, entitlement, plans });
  } catch (error) {
    console.error("iap status: entitlement lookup failed:", error);
    // 로그인은 확실하다. 구독권만 모른 채로 응답한다.
    return NextResponse.json({ authenticated: true, entitlement: null, plans });
  }
}
