import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { createPendingPayment } from "@/lib/payments";

// Creates a server-side PENDING order and returns the data the client needs to
// open the Toss payment window. The amount is taken from the product config
// (never from the client) so it can't be tampered with.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const product = getProduct(body.productId);
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json({ error: "결제 설정이 완료되지 않았습니다." }, { status: 500 });
    }

    const { orderId } = await createPendingPayment({
      userId: user.id,
      productId: product.id,
      amount: product.price,
    });

    return NextResponse.json({
      clientKey,
      orderId,
      orderName: product.title,
      amount: product.price,
      customerKey: user.id,
      customerEmail: user.email,
      customerName: user.nickname,
    });
  } catch (error) {
    console.error("checkout error:", error);
    return NextResponse.json({ error: "결제 준비 중 오류가 발생했습니다." }, { status: 500 });
  }
}
