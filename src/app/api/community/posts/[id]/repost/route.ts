import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleCommunityRepost } from "@/lib/community";

export const dynamic = "force-dynamic";

// 리포스트 토글 — 글 카드·상세의 ⟲ 버튼.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { id } = await params;
    const result = await toggleCommunityRepost(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (message === "CommunityRepostSelf") {
      return NextResponse.json({ error: "내 글은 리포스트할 수 없어요." }, { status: 400 });
    }
    console.error("community repost error:", error);
    return NextResponse.json({ error: "리포스트하지 못했습니다." }, { status: 500 });
  }
}
