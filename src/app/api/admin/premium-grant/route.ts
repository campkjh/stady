import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  grantFreePremiumDays,
  getPremiumGrantRaw,
  revokeFreePremium,
} from "@/lib/premiumGrant";

// 어드민: 계정별 프리미엄권(무료 프리미엄) 수동 지급/회수.
//  GET  ?userId=  → 현재 지급된 만료 시각
//  POST { userId, days } → days 만큼 지급(누적 연장). 2주=14, 한달=30, 두달=60
//  DELETE { userId } → 회수

const ALLOWED_DAYS = new Set([14, 30, 60]);

function errStatus(error: unknown): number | null {
  if (error instanceof Error && error.message === "Unauthorized") return 401;
  if (error instanceof Error && error.message === "Forbidden") return 403;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const userId = request.nextUrl.searchParams.get("userId") || "";
    if (!userId) return NextResponse.json({ error: "userId 필요" }, { status: 400 });
    const expiresAt = await getPremiumGrantRaw(userId);
    return NextResponse.json({ expiresAt: expiresAt ? expiresAt.toISOString() : null });
  } catch (error) {
    const s = errStatus(error);
    if (s) return NextResponse.json({ error: s === 401 ? "로그인 필요" : "권한 없음" }, { status: s });
    console.error("premium-grant GET error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const userId = body?.userId ? String(body.userId) : "";
    const days = Number(body?.days);
    if (!userId) return NextResponse.json({ error: "userId 필요" }, { status: 400 });
    if (!ALLOWED_DAYS.has(days)) {
      return NextResponse.json({ error: "허용되지 않은 기간(14/30/60일만)" }, { status: 400 });
    }
    // 존재하는 유저인지 확인(FK로도 막히지만 명확한 에러를 위해)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

    const expiresAt = await grantFreePremiumDays(userId, days, "admin_grant");
    return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const s = errStatus(error);
    if (s) return NextResponse.json({ error: s === 401 ? "로그인 필요" : "권한 없음" }, { status: s });
    console.error("premium-grant POST error:", error);
    return NextResponse.json({ error: "지급 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const userId = body?.userId ? String(body.userId) : request.nextUrl.searchParams.get("userId") || "";
    if (!userId) return NextResponse.json({ error: "userId 필요" }, { status: 400 });
    await revokeFreePremium(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const s = errStatus(error);
    if (s) return NextResponse.json({ error: s === 401 ? "로그인 필요" : "권한 없음" }, { status: s });
    console.error("premium-grant DELETE error:", error);
    return NextResponse.json({ error: "회수 실패" }, { status: 500 });
  }
}
