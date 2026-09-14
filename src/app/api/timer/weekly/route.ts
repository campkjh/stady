import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getWeeklyRanking, getMyWeeklyAwards, weekStartKst, WEEKLY_AWARD_DAYS, WEEKLY_AWARD_RANKS,
} from "@/lib/studyTimer";

export const dynamic = "force-dynamic";

// 주간 랭킹(월요일 시작, KST) + 내가 받은 시상 이력.
export async function GET() {
  try {
    const me = await getCurrentUser();
    const [ranking, awards] = await Promise.all([
      getWeeklyRanking(me?.id ?? null, 50),
      me ? getMyWeeklyAwards(me.id) : Promise.resolve([]),
    ]);
    return NextResponse.json({
      weekStart: weekStartKst().toISOString(),
      awardRanks: WEEKLY_AWARD_RANKS,
      awardDays: WEEKLY_AWARD_DAYS,
      ranking,
      awards,
    });
  } catch (error) {
    console.error("timer weekly GET error:", error);
    return NextResponse.json({ ranking: [], awards: [], awardRanks: 3, awardDays: 7 });
  }
}
