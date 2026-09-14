import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrIssueCheck, answerCheck } from "@/lib/studyTimer";

export const dynamic = "force-dynamic";

// 공부 중 확인 퀴즈. GET = 지금 떠야 할 퀴즈(없으면 null), POST = 응답.
// 답을 안 하고 3시간이 지나면 서버가 타이머를 끈다(studyTimer.CHECK_GRACE_MS).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ check: null });
    return NextResponse.json({ check: await getOrIssueCheck(user.id) });
  } catch (error) {
    console.error("timer check GET error:", error);
    // 확인 퀴즈는 보조 기능이다 — 실패해도 타이머 화면이 깨지면 안 된다.
    return NextResponse.json({ check: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const checkId = String((body as { checkId?: unknown }).checkId ?? "");
    const selected = (body as { selected?: unknown }).selected === true;
    if (!checkId) return NextResponse.json({ error: "checkId 가 필요합니다." }, { status: 400 });
    return NextResponse.json(await answerCheck(user.id, checkId, selected));
  } catch (error) {
    console.error("timer check POST error:", error);
    return NextResponse.json({ error: "응답을 저장하지 못했습니다." }, { status: 500 });
  }
}
