import { NextRequest, NextResponse } from "next/server";
import { verifyAppleNotification } from "@/lib/iap/apple";
import { upsertVerifiedSubscription } from "@/lib/iap/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// App Store Server Notifications V2 endpoint. Apple POSTs { signedPayload } on
// renewals, cancellations, refunds, etc. We decode and update the matching
// subscription row (found by originalTransactionId — Apple doesn't send our user
// id). Always return 2xx so Apple doesn't retry a message we've handled/ignored.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const signedPayload = body.signedPayload ? String(body.signedPayload) : "";
    if (!signedPayload) return NextResponse.json({ ok: true });

    const { notificationType, subtype, verified } = await verifyAppleNotification(signedPayload);
    if (verified) {
      try {
        await upsertVerifiedSubscription(null, verified);
      } catch (e) {
        // Unknown subscription (never verified by a logged-in user) — log & ack.
        console.warn("apple notification unmatched:", notificationType, subtype, (e as Error).message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("apple notification error:", error);
    // Still 2xx: a malformed message will only be retried uselessly otherwise.
    return NextResponse.json({ ok: true });
  }
}
