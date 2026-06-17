import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  confirmTossPayment,
  getPaymentByOrderId,
  markPaymentDone,
  markPaymentFailed,
} from "@/lib/payments";

// Confirms a Toss payment after the user returns to successUrl.
// Verifies the order belongs to the user and that the amount matches the
// server-side PENDING record before calling Toss with the secret key.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentKey = String(body.paymentKey || "");
    const orderId = String(body.orderId || "");
    const amount = Number(body.amount);

    if (!paymentKey || !orderId || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "잘못된 결제 정보입니다." }, { status: 400 });
    }

    const payment = await getPaymentByOrderId(orderId);
    if (!payment) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (payment.user_id !== user.id) {
      return NextResponse.json({ error: "본인의 주문이 아닙니다." }, { status: 403 });
    }
    if (payment.status === "DONE") {
      // Idempotent: already confirmed (e.g. page refresh).
      return NextResponse.json({ ok: true, productId: payment.product_id });
    }
    if (Number(payment.amount) !== amount) {
      return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
    }

    try {
      const result = await confirmTossPayment({ paymentKey, orderId, amount });
      await markPaymentDone(orderId, paymentKey, (result.method as string) ?? null);
      return NextResponse.json({ ok: true, productId: payment.product_id });
    } catch (error) {
      await markPaymentFailed(orderId);
      const message = error instanceof Error ? error.message : "결제 승인에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("confirm error:", error);
    return NextResponse.json({ error: "결제 승인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
