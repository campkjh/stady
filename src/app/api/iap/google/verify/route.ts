import { NextRequest, NextResponse } from "next/server";
import { createPrivateKey } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { GoogleNotConfiguredError, normalizePrivateKey, verifyGooglePurchase } from "@/lib/iap/google";
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

  // 임시 진단(관리자 전용) — private_key 가 어떻게 저장됐는지 구조만 확인. 키 내용 노출 안 함.
  if (purchaseToken === "__KEYCHECK__" && user.role === "admin") {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
    const norm = normalizePrivateKey(raw);
    let parse = "ok";
    try { createPrivateKey(norm); } catch (e) { parse = e instanceof Error ? e.message : "fail"; }
    return NextResponse.json({
      raw: { len: raw.length, startsQuote: /^["']/.test(raw), hasLiteralBackslashN: /\\n/.test(raw), hasRealNewline: /\n/.test(raw), hasBegin: raw.includes("BEGIN"), hasSpaceInBody: / [A-Za-z0-9+/]{20}/.test(raw) },
      norm: { len: norm.length, lines: norm.split("\n").length, hasBegin: norm.includes("BEGIN PRIVATE KEY"), hasEnd: norm.includes("END PRIVATE KEY"), firstLine: norm.split("\n")[0]?.slice(0, 30) },
      parse,
      email: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").slice(0, 12),
      pkg: process.env.GOOGLE_PLAY_PACKAGE_NAME || null,
    });
  }

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
