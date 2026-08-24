import { NextResponse } from "next/server";
import { getCurrentUser, isMasterAdminEmail } from "@/lib/auth";
import { appleCredentialSelfTest } from "@/lib/iap/apple";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 관리자 전용 진단: 샌드박스 실결제 없이 APPLE_IAP_* 자격증명만 점검한다.
// (결제 실패가 "키 문제"인지 "그 외"인지 한 번에 가르려고 둔 것 — 비밀값은 응답에
//  절대 싣지 않고 성공/실패와 Apple 이 준 상태 코드만 돌려준다.)
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isMasterAdminEmail(user.email)) {
    // 관리자가 아니면 존재 자체를 알리지 않는다.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = await appleCredentialSelfTest();
  return NextResponse.json(result);
}
