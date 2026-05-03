import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const me = await getCurrentUser();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Auto-close stale active sessions
    const stale = await prisma.studySession.findMany({
      where: { endedAt: null, lastPingAt: { lt: twoMinutesAgo } },
    });
    for (const s of stale) {
      const elapsedSec = Math.floor((s.lastPingAt.getTime() - s.startedAt.getTime()) / 1000);
      await prisma.studySession.update({
        where: { id: s.id },
        data: { endedAt: s.lastPingAt, totalSeconds: elapsedSec },
      });
    }

    // Get all users
    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: { id: true, nickname: true, avatar: true },
    });

    const now = Date.now();

    // For each user, compute today's total time + active session info
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const userCards = await Promise.all(
      users.map(async (u) => {
        // Today's completed sessions
        const todayDone = await prisma.studySession.findMany({
          where: {
            userId: u.id,
            startedAt: { gte: startOfDay },
            endedAt: { not: null },
          },
          select: { totalSeconds: true },
        });
        const doneTotal = todayDone.reduce((sum, s) => sum + s.totalSeconds, 0);

        // Active session
        const active = await prisma.studySession.findFirst({
          where: { userId: u.id, endedAt: null },
          orderBy: { startedAt: "desc" },
        });

        const activeElapsed = active
          ? Math.floor((now - active.startedAt.getTime()) / 1000)
          : 0;

        return {
          userId: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          isActive: !!active,
          subject: active?.subject || null,
          activeStartedAt: active?.startedAt || null,
          activeElapsedSeconds: activeElapsed,
          todayTotalSeconds: doneTotal + activeElapsed,
          isMe: me?.id === u.id,
        };
      })
    );

    // Sort: active first (by elapsed desc), then by todayTotal desc
    userCards.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isActive && b.isActive) return b.activeElapsedSeconds - a.activeElapsedSeconds;
      return b.todayTotalSeconds - a.todayTotalSeconds;
    });

    const activeCount = userCards.filter((u) => u.isActive).length;
    const mySession = userCards.find((u) => u.isMe && u.isActive) || null;
    const myStats = me ? await getMyTimerStats(me.id, now) : null;

    return NextResponse.json({
      users: userCards,
      activeCount,
      totalCount: userCards.length,
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
