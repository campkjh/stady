import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface MemoRow {
  studyDate: string;
  memo: string;
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function makeDayRange(count: number) {
  const today = new Date();
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(dayKey(date));
  }
  return days;
}

async function ensureMemoTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimerStudyMemo" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "studyDate" TEXT NOT NULL,
      "memo" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TimerStudyMemo_user_date_key"
    ON "TimerStudyMemo" ("userId", "studyDate")
  `);
}

export async function GET() {
  try {
    const user = await requireUser();
    await ensureMemoTable();

    const days = makeDayRange(35);
    const daySet = new Set(days);
    const totals = new Map(days.map((date) => [date, { totalSeconds: 0, sessionCount: 0 }]));
    const now = Date.now();

    const sessions = await prisma.studySession.findMany({
      where: { userId: user.id },
      select: { startedAt: true, endedAt: true, totalSeconds: true },
    });

    for (const session of sessions) {
      const key = dayKey(session.startedAt);
      if (!daySet.has(key)) continue;
      const entry = totals.get(key);
      if (!entry) continue;
      const activeSeconds = session.endedAt ? 0 : Math.max(0, Math.floor((now - session.startedAt.getTime()) / 1000));
      entry.totalSeconds += session.totalSeconds + activeSeconds;
      entry.sessionCount += 1;
    }

    const memoRows = await prisma.$queryRawUnsafe<MemoRow[]>(
      `
        SELECT "studyDate", "memo"
        FROM "TimerStudyMemo"
        WHERE "userId" = $1
      `,
      user.id
    );
    const memoMap = new Map(
      memoRows
        .filter((row) => daySet.has(row.studyDate))
        .map((row) => [row.studyDate, row.memo])
    );

    const dayItems = days.map((date) => ({
      date,
      totalSeconds: totals.get(date)?.totalSeconds || 0,
      sessionCount: totals.get(date)?.sessionCount || 0,
      memo: memoMap.get(date) || "",
    }));

    const totalSeconds = dayItems.reduce((sum, day) => sum + day.totalSeconds, 0);
    const activeDays = dayItems.filter((day) => day.totalSeconds > 0).length;
    const bestDay = [...dayItems].sort((a, b) => b.totalSeconds - a.totalSeconds)[0] || null;
    const recent7 = dayItems.slice(-7);

    return NextResponse.json({
      days: dayItems,
      summary: {
        totalSeconds,
        activeDays,
        averageSeconds: activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0,
        bestDay,
        recent7TotalSeconds: recent7.reduce((sum, day) => sum + day.totalSeconds, 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer analysis GET error:", error);
    return NextResponse.json({ error: "분석 정보를 가져오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await ensureMemoTable();
    const { date, memo } = await request.json();

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "날짜가 올바르지 않습니다." }, { status: 400 });
    }

    const nextMemo = typeof memo === "string" ? memo.slice(0, 500) : "";
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "TimerStudyMemo" ("id", "userId", "studyDate", "memo")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("userId", "studyDate")
        DO UPDATE SET "memo" = $4, "updatedAt" = CURRENT_TIMESTAMP
      `,
      randomUUID(),
      user.id,
      date,
      nextMemo
    );

    return NextResponse.json({ success: true, memo: nextMemo });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer analysis POST error:", error);
    return NextResponse.json({ error: "메모를 저장하지 못했습니다." }, { status: 500 });
  }
}
