import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { hasPurchased } from "@/lib/payments";

// Tells the client whether the current user has already purchased a product,
// so the store UI can show "다운로드" instead of the buy button.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const productId = request.nextUrl.searchParams.get("productId") || "";
    const product = getProduct(productId);
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ authenticated: false, purchased: false });
    }

    const purchased = await hasPurchased(user.id, product.id);
    return NextResponse.json({ authenticated: true, purchased });
  } catch (error) {
    console.error("payment status error:", error);
    return NextResponse.json({ error: "상태를 확인하지 못했습니다." }, { status: 500 });
  }
}
