import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AppleNotConfiguredError, verifyAppleTransaction } from "@/lib/iap/apple";
import { getActiveEntitlement, upsertVerifiedSubscription } from "@/lib/iap/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the web layer after the iOS shell completes a StoreKit2 purchase and
// hands back the transaction. The SERVER re-verifies with Apple before granting.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const transactionId = body.transactionId ? String(body.transactionId) : undefined;
  const signedTransaction = body.signedTransaction ? String(body.signedTransaction) : undefined;
  const environmentHint =
    body.environment === "Sandbox" ? "Sandbox" : body.environment === "Production" ? "Production" : undefined;

  if (!transactionId && !signedTransaction) {
    return NextResponse.json({ error: "결제 정보가 없습니다." }, { status: 400 });
  }

  try {
    const verified = await verifyAppleTransaction({ transactionId, signedTransaction, environmentHint });
    await upsertVerifiedSubscription(user.id, verified);
    const entitlement = await getActiveEntitlement(user.id);
    return NextResponse.json({ ok: true, entitlement });
  } catch (error) {
    if (error instanceof AppleNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "결제 검증에 실패했습니다.";
    console.error("apple verify error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
