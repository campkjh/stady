import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrIssueCheck } from "@/lib/studyTimer";

export async function POST() {
  try {
    const user = await requireUser();

    const active = await prisma.studySession.findFirst({
      where: { userId: user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (!active) {
      return NextResponse.json({ session: null, check: null });
    }

    const now = new Date();
    const elapsedSec = Math.floor((now.getTime() - active.startedAt.getTime()) / 1000);
    const session = await prisma.studySession.update({
      where: { id: active.id },
      data: { lastPingAt: now, totalSeconds: elapsedSec },
    });

    // 확인 퀴즈는 전역 핑에 얹어 내려보낸다 — 별도 폴링을 만들지 않기 위해서다.
    // 실패해도 핑 자체는 성공으로 둔다(타이머가 우선).
    let check = null;
    try {
      check = await getOrIssueCheck(user.id);
    } catch (e) {
      console.error("timer check skipped:", e);
    }
    return NextResponse.json({ session, check });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer ping error:", error);
    return NextResponse.json({ error: "ping 실패" }, { status: 500 });
  }
}
