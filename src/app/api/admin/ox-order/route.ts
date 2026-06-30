import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getOxOrderMap, setOxOrders } from "@/lib/oxOrder";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin ox-order error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// 어드민: 현재 OX 세트 순서 맵 조회.
export async function GET() {
  try {
    await requireAdmin();
    const orderMap = await getOxOrderMap();
    return NextResponse.json({ orderMap });
  } catch (error) {
    return adminError(error);
  }
}

// 어드민: OX 세트 순서 일괄 저장. body: { orders: [{ setId, sortOrder }] }
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const orders = Array.isArray(body?.orders) ? body.orders : [];
    const clean = orders
      .map((o: unknown) => {
        const obj = o as { setId?: unknown; sortOrder?: unknown };
        return { setId: String(obj?.setId ?? ""), sortOrder: Number(obj?.sortOrder ?? 0) };
      })
      .filter((o: { setId: string }) => o.setId.length > 0);
    await setOxOrders(clean);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
