import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { applyReferralCode } from "@/lib/referrals";

export const runtime = "nodejs";

// 사용자가 직접 초대코드를 입력해 적용한다.
// 초대 링크(/login?invite=CODE)를 타지 않고 가입한 경우의 유일한 경로.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const result = await applyReferralCode(user.id, body?.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("referrals/apply POST error:", error);
    return NextResponse.json({ error: "초대코드 적용 중 오류가 발생했습니다." }, { status: 500 });
  }
}
