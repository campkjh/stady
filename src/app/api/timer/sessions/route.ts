import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureUserStatusMessageColumn } from "@/lib/user-status";

interface ActiveRow {
  userId: string;
  nickname: string;
  avatar: string | null;
  statusMessage: string | null;
  subject: string;
  startedAt: Date;
}

interface TodayRow {
  userId: string;
  nickname: string;
  avatar: string | null;
  statusMessage: string | null;
  done: number;
}

interface UserCard {
  userId: string;
  nickname: string;
  avatar: string | null;
  statusMessage: string | null;
  isActive: boolean;
  subject: string | null;
  activeStartedAt: Date | null;
  activeElapsedSeconds: number;
  todayTotalSeconds: number;
  isMe: boolean;
}

// 공부 현황. 예전엔 전체 유저(수천 명)를 불러와 유저마다 쿼리 2개씩 돌려(N+1)
// 매우 무거웠다. 이제는 "현재 공부중(active)" + "오늘 공부한" 유저만 집계 쿼리로
// 가져온다 — 등록 유저 수와 무관하게 가볍다.
export async function GET() {
  try {
    const me = await getCurrentUser();
    await ensureUserStatusMessageColumn();

    const now = Date.now();
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);

    // 1) 오래된(2분 넘게 핑 없음) active 세션을 단일 UPDATE로 일괄 종료.
    await prisma.$executeRaw`
      UPDATE "StudySession"
      SET "endedAt" = "lastPingAt",
          "totalSeconds" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("lastPingAt" - "startedAt"))))::int
      WHERE "endedAt" IS NULL AND "lastPingAt" < ${twoMinutesAgo}
    `;

    // 2) 헤더 "X / N명 공부 중"의 N — 등록 유저 수(단일 count).
    const totalRows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "User" WHERE "role" = 'user'
    `;
    const totalCount = Number(totalRows[0]?.count ?? 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 3) 현재 공부중인 유저만 — 유저당 가장 최근 active 세션 1개.
    const activeRows = await prisma.$queryRaw<ActiveRow[]>`
      SELECT DISTINCT ON (s."userId")
             s."userId", s."subject", s."startedAt",
             u."nickname", u."avatar", u."statusMessage"
      FROM "StudySession" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE s."endedAt" IS NULL AND u."role" = 'user'
      ORDER BY s."userId", s."startedAt" DESC
    `;

    // 4) 오늘 공부한 유저별 완료 시간 합(누적기록 랭킹용) — 오늘 세션이 있는 유저만.
    const todayRows = await prisma.$queryRaw<TodayRow[]>`
      SELECT s."userId",
             SUM(s."totalSeconds")::int AS done,
             u."nickname", u."avatar", u."statusMessage"
      FROM "StudySession" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE s."endedAt" IS NOT NULL
        AND s."startedAt" >= ${startOfDay}
        AND u."role" = 'user'
      GROUP BY s."userId", u."nickname", u."avatar", u."statusMessage"
    `;

    // 5) active ∪ today (+ me) 머지.
    const map = new Map<string, UserCard>();

    for (const r of todayRows) {
      map.set(r.userId, {
        userId: r.userId,
        nickname: r.nickname,
        avatar: r.avatar,
        statusMessage: r.statusMessage,
        isActive: false,
        subject: null,
        activeStartedAt: null,
        activeElapsedSeconds: 0,
        todayTotalSeconds: r.done,
        isMe: me?.id === r.userId,
      });
    }

    for (const r of activeRows) {
      const elapsed = Math.max(0, Math.floor((now - new Date(r.startedAt).getTime()) / 1000));
      const existing = map.get(r.userId);
      if (existing) {
        existing.isActive = true;
        existing.subject = r.subject;
        existing.activeStartedAt = r.startedAt;
        existing.activeElapsedSeconds = elapsed;
        existing.todayTotalSeconds += elapsed;
      } else {
        map.set(r.userId, {
          userId: r.userId,
          nickname: r.nickname,
          avatar: r.avatar,
          statusMessage: r.statusMessage,
          isActive: true,
          subject: r.subject,
          activeStartedAt: r.startedAt,
          activeElapsedSeconds: elapsed,
          todayTotalSeconds: elapsed,
          isMe: me?.id === r.userId,
        });
      }
    }

    // me가 active도 아니고 오늘 공부도 안 했으면 빈 카드로 포함(낙관적 업데이트/내 카드용).
    if (me && !map.has(me.id)) {
      map.set(me.id, {
        userId: me.id,
        nickname: me.nickname,
        avatar: me.avatar ?? null,
        statusMessage: null,
        isActive: false,
        subject: null,
        activeStartedAt: null,
        activeElapsedSeconds: 0,
        todayTotalSeconds: 0,
        isMe: true,
      });
    }

    const userCards = Array.from(map.values());
    const activeCount = activeRows.length;
    const mySession = userCards.find((u) => u.isMe && u.isActive) || null;
    const myStats = me ? await getMyTimerStats(me.id, now) : null;

    return NextResponse.json({
      users: userCards,
      activeCount,
      totalCount,
      mySession,
      myStats,
    });
  } catch (error) {
    console.error("Timer sessions error:", error);
    return NextResponse.json({ error: "세션 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function getMyTimerStats(userId: string, now: number) {
  const sessions = await prisma.studySession.findMany({
    where: { userId },
    select: { startedAt: true, endedAt: true, totalSeconds: true },
  });

  let activeElapsedSeconds = 0;
  const dayKeys = new Set<string>();
  const completedSessionCount = sessions.filter((session) => session.endedAt).length;
  const completedTotalSeconds = sessions.reduce((sum, session) => sum + session.totalSeconds, 0);

  for (const session of sessions) {
    dayKeys.add(dayKey(session.startedAt));
    if (!session.endedAt) {
      activeElapsedSeconds += Math.max(0, Math.floor((now - session.startedAt.getTime()) / 1000));
    }
  }

  let streakDays = 0;
  for (let i = 0; i < 365; i++) {
    const key = dayKey(new Date(now - i * 24 * 60 * 60 * 1000));
    if (!dayKeys.has(key)) break;
    streakDays += 1;
  }

  return {
    totalStudySeconds: completedTotalSeconds + activeElapsedSeconds,
    activeDays: dayKeys.size,
    streakDays,
    completedSessionCount,
  };
}
