import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCommunityBlocks, toggleCommunityBlock } from "@/lib/community";

export const dynamic = "force-dynamic";

// 내가 차단한 사용자 목록 (마이페이지 > 차단한 사용자).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const rows = await listCommunityBlocks(user.id);
  return NextResponse.json({
    blocks: rows.map((row) => ({
      userId: row.blocked_id,
      nickname: row.nickname || "익명",
      createdAt: row.created_at,
    })),
  });
}

// 차단 토글 (App Store 가이드라인 1.2 — 특정 사용자 콘텐츠 차단 수단).
// 차단은 단방향이라 상대에게 알리지 않고, 차단한 사람 화면에서만 숨는다.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId ? String(body.userId) : "";
  if (!targetUserId) {
    return NextResponse.json({ error: "대상이 없습니다." }, { status: 400 });
  }
  try {
    const result = await toggleCommunityBlock(user.id, targetUserId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CommunityBlockSelf") {
      return NextResponse.json({ error: "자기 자신은 차단할 수 없어요." }, { status: 400 });
    }
    console.error("community block error:", error);
    return NextResponse.json({ error: "차단 처리를 하지 못했습니다." }, { status: 500 });
  }
}
