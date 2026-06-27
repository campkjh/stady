import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 활성 커뮤니티 글 중 가장 최신 작성 시각만 반환하는 경량 엔드포인트.
// 하단 네비의 "안 본 새 글" 빨간 인디케이터 판단에 쓴다.
export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<{ latest: Date | null }[]>(
      `SELECT MAX("created_at") AS latest FROM "CommunityPost" WHERE "is_active" = true`
    );
    return NextResponse.json({ latest: rows[0]?.latest ?? null });
  } catch {
    return NextResponse.json({ latest: null });
  }
}
