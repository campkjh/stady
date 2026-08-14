import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { GoogleNotConfiguredError, verifyGooglePurchase } from "@/lib/iap/google";
import { getActiveEntitlement, upsertVerifiedSubscription } from "@/lib/iap/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the web layer after the Android shell completes a Play Billing
// purchase and hands back the purchaseToken. The SERVER re-verifies with Google
// before granting.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const purchaseToken = body.purchaseToken ? String(body.purchaseToken) : "";
  const productId = body.productId ? String(body.productId) : undefined;

  if (!purchaseToken) {
    return NextResponse.json({ error: "결제 정보가 없습니다." }, { status: 400 });
  }

  try {
    const verified = await verifyGooglePurchase({ purchaseToken, productId });
    await upsertVerifiedSubscription(user.id, verified);
    const entitlement = await getActiveEntitlement(user.id);
    return NextResponse.json({ ok: true, entitlement });
  } catch (error) {
    if (error instanceof GoogleNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "결제 검증에 실패했습니다.";
    console.error("google verify error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
