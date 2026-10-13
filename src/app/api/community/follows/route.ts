import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleCommunityFollow } from "@/lib/community";

export const dynamic = "force-dynamic";

// 팔로우 토글 — 글 카드의 '팔로우' 버튼.
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
    const result = await toggleCommunityFollow(user.id, targetUserId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CommunityFollowSelf") {
      return NextResponse.json({ error: "자기 자신은 팔로우할 수 없어요." }, { status: 400 });
    }
    console.error("community follow error:", error);
    return NextResponse.json({ error: "팔로우하지 못했습니다." }, { status: 500 });
  }
}
