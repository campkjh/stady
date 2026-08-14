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

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, entitlement: null, plans });
    }
    const entitlement = await getActiveEntitlement(user.id);
    return NextResponse.json({ authenticated: true, entitlement, plans });
  } catch (error) {
    console.error("iap status error:", error);
    return NextResponse.json({ authenticated: false, entitlement: null, plans });
  }
}
