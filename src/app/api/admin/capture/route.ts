import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 캡쳐용 화면 데이터 — 총 회원수 + 이번달 가입자/구독자 프로필.
// 프로필은 화면에 촘촘히 뿌리는 용도라 상한을 둔다(아바타가 data URL 이라 payload 가 커진다).
const MAX_PROFILES = 160;

interface Profile {
  id: string;
  nickname: string;
  avatar: string | null;
}

export async function GET() {
  try {
    await requireAdmin();

    const [totalUsers] = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM "User"`
    );

    // 이번달 가입자
    const [newCount] = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM "User"
       WHERE date_trunc('month', "createdAt") = date_trunc('month', now())`
    );
    // 아바타가 있는 사람을 먼저 보여줘야 그림이 산다(대부분 아바타가 없다).
    const newProfiles = await prisma.$queryRawUnsafe<Profile[]>(
      `SELECT "id", "nickname", "avatar" FROM "User"
       WHERE date_trunc('month', "createdAt") = date_trunc('month', now())
       ORDER BY ("avatar" IS NULL), "createdAt" DESC
       LIMIT ${MAX_PROFILES}`
    );


    const now = new Date();
    return NextResponse.json({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      totalUsers: totalUsers?.c ?? 0,
      newUsers: { count: newCount?.c ?? 0, profiles: newProfiles },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin/capture GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
