import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireUser();

    const active = await prisma.studySession.findFirst({
      where: { userId: user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (!active) {
      return NextResponse.json({ session: null });
    }

    const session = await prisma.studySession.update({
      where: { id: active.id },
      data: { lastPingAt: new Date() },
    });

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer ping error:", error);
    return NextResponse.json({ error: "ping 실패" }, { status: 500 });
  }
}
