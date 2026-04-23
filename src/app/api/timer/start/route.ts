import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const subject = (body.subject || "공부중").toString().slice(0, 50);

    // End any existing active session first
    await prisma.studySession.updateMany({
      where: { userId: user.id, endedAt: null },
      data: { endedAt: new Date() },
    });

    const session = await prisma.studySession.create({
      data: {
        userId: user.id,
        subject,
      },
    });

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Timer start error:", error);
    return NextResponse.json({ error: "타이머 시작 중 오류가 발생했습니다." }, { status: 500 });
  }
}
