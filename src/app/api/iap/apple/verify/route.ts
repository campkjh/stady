import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AppleNotConfiguredError, AppleUpstreamError, verifyAppleTransaction } from "@/lib/iap/apple";
import { getActiveEntitlement, upsertVerifiedSubscription } from "@/lib/iap/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Apple 조회는 샌드박스 색인 지연 때문에 재시도가 들어간다 — 기본 10초로는 모자란다.
export const maxDuration = 30;

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
    const detail = error instanceof Error ? error.message : String(error);
    // 여기까지 왔다면 사용자는 이미 돈을 냈다. 원인별로 (1) 재시도 가치가 있는지와
    // (2) 화면에 남길 진단 코드를 나눠서 돌려준다 — 결제 화면 스크린샷만 보고도
    // 어느 고리가 끊겼는지 알 수 있어야 한다(App Review 리젝 대응).
    if (error instanceof AppleNotConfiguredError) {
      console.error("apple verify error [E-APPLE-ENV]:", detail);
      return NextResponse.json(
        { error: "결제 확인 설정이 완료되지 않았어요. (E-APPLE-ENV)", code: "E-APPLE-ENV" },
        { status: 503 }
      );
    }
    if (error instanceof AppleUpstreamError) {
      const code = error.retryable ? "E-APPLE-LOOKUP" : "E-APPLE-AUTH";
      console.error(`apple verify error [${code}]:`, detail);
      return NextResponse.json(
        {
          error: error.retryable
            ? "결제 확인이 지연되고 있어요. 잠시 후 ‘구매 복원’을 누르면 적용됩니다. (E-APPLE-LOOKUP)"
            : "결제 확인 설정에 문제가 있어요. (E-APPLE-AUTH)",
          code,
        },
        // retryable 은 5xx 로 내보내야 클라이언트가 한 번 더 시도한다.
        { status: error.retryable ? 502 : 503 }
      );
    }
    console.error("apple verify error [E-APPLE-VERIFY]:", detail);
    return NextResponse.json(
      { error: `${detail} (E-APPLE-VERIFY)`, code: "E-APPLE-VERIFY" },
      { status: 400 }
    );
  }
}
