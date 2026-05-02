import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getReferralSummary } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const summary = await getReferralSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Referrals GET error:", error);
    return NextResponse.json({ error: "초대 정보를 가져오지 못했습니다." }, { status: 500 });
  }
}
