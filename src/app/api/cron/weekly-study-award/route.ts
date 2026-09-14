import { NextRequest, NextResponse } from "next/server";
import { awardWeeklyTop, closeExpiredCheckSessions } from "@/lib/studyTimer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매주 월요일 새벽(KST)에 도는 크론(vercel.json). 지난 주 공부시간 1~3위에게 프라임 7일.
// 같은 주는 두 번 지급되지 않는다(WeeklyStudyAward PK).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    // 확인 퀴즈를 놓친 채 켜져 있는 타이머도 이 참에 정리한다.
    const closed = await closeExpiredCheckSessions();
    const result = await awardWeeklyTop(-1);
    return NextResponse.json({ ok: true, closedSessions: closed, ...result });
  } catch (error) {
    console.error("weekly study award cron error:", error);
    return NextResponse.json({ error: "주간 시상 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
