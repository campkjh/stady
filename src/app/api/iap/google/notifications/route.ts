import { NextRequest, NextResponse } from "next/server";
import { decodeGoogleNotification, verifyGooglePurchase } from "@/lib/iap/google";
import { upsertVerifiedSubscription } from "@/lib/iap/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google Play Real-time Developer Notifications (RTDN), delivered via Pub/Sub
// push. We decode the purchaseToken, re-fetch the authoritative state from
// Google, then update the matching subscription row (found by purchaseToken).
// Always ack (2xx) so Pub/Sub doesn't redeliver a handled/ignored message.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const notif = decodeGoogleNotification(body);
    if (!notif?.purchaseToken) return NextResponse.json({ ok: true });

    const verified = await verifyGooglePurchase({
      purchaseToken: notif.purchaseToken,
      productId: notif.productId,
    });
    // A voided/revoked purchase removes entitlement even if the API still reports a period.
    if (notif.voided) verified.status = "REFUNDED";

    try {
      await upsertVerifiedSubscription(null, verified);
    } catch (e) {
      console.warn("google notification unmatched:", notif.notificationType, (e as Error).message);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("google notification error:", error);
    return NextResponse.json({ ok: true });
  }
}
