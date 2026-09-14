import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminPayments, OWNER_SETTLEMENT_EMAIL } from "@/lib/adminPayments";

export const dynamic = "force-dynamic";

// 어드민: 결제/구독 전체 조회 (IAP 프리미엄 + 토스 단건 + 토스 정기).
export async function GET() {
  try {
    const admin = await requireAdmin();
    // 내 몫 정산은 요청자가 그 계정일 때만 계산해서 내려보낸다(다른 어드민 응답엔 아예 없음).
    const data = await getAdminPayments({
      ownerSettlement: (admin.email ?? "").toLowerCase() === OWNER_SETTLEMENT_EMAIL,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin payments GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
