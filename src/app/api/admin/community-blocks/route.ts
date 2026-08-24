import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllCommunityBlocks } from "@/lib/community";

export const dynamic = "force-dynamic";

// 운영자용 차단 현황. 반복해서 차단당하는 계정은 신고가 없어도 살펴볼 신호다.
export async function GET() {
  try {
    await requireAdmin();
    const { rows, top } = await listAllCommunityBlocks();
    return NextResponse.json({
      blocks: rows.map((row) => ({
        blockerId: row.blocker_id,
        blockerNickname: row.blocker_nickname || "알 수 없음",
        blockedId: row.blocked_id,
        blockedNickname: row.blocked_nickname || "알 수 없음",
        createdAt: row.created_at,
      })),
      mostBlocked: top.map((row) => ({
        userId: row.blocked_id,
        nickname: row.nickname || "알 수 없음",
        count: row.c,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Admin community blocks API error:", error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
