import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const me = await getCurrentUser();

    // Active threshold: lastPingAt within last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Auto-close stale sessions (no ping for >2 min)
    await prisma.studySession.updateMany({
      where: {
        endedAt: null,
        lastPingAt: { lt: twoMinutesAgo },
      },
      data: { endedAt: new Date() },
    });

    // Fetch all active sessions
    const active = await prisma.studySession.findMany({
      where: { endedAt: null },
      include: { user: { select: { id: true, nickname: true, avatar: true } } },
      orderBy: { startedAt: "asc" },
    });

    // Compute elapsed seconds for each
    const now = Date.now();
    const sessions = active.map((s) => ({
      id: s.id,
      userId: s.userId,
      subject: s.subject,
      startedAt: s.startedAt,
      elapsedSeconds: Math.floor((now - s.startedAt.getTime()) / 1000),
      user: s.user,
      isMe: me?.id === s.userId,
    }));

    // My session (if any)
    const mySession = me ? sessions.find((s) => s.userId === me.id) ?? null : null;

    return NextResponse.json({
      sessions,
      mySession,
      count: sessions.length,
    });
  } catch (error) {
    console.error("Timer sessions error:", error);
    return NextResponse.json({ error: "세션 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
