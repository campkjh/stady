import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBlockedUserContent, listCommunityBlocks, toggleCommunityBlock } from "@/lib/community";

export const dynamic = "force-dynamic";

// 내가 차단한 사용자 목록 (마이페이지 > 차단한 사용자).
// ?userId=... 를 주면 그 사람 때문에 숨겨진 글·댓글을 돌려준다(해제 판단용).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const targetId = new URL(request.url).searchParams.get("userId");
  if (targetId) {
    try {
      const content = await getBlockedUserContent(user.id, targetId);
      return NextResponse.json({
        posts: content.posts.map((post) => ({
          id: post.id,
          title: post.title,
          createdAt: post.created_at,
        })),
        comments: content.comments.map((comment) => ({
          id: comment.id,
          postId: comment.post_id,
          postTitle: comment.post_title,
          content: comment.content,
          createdAt: comment.created_at,
        })),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CommunityBlockNotFound") {
        return NextResponse.json({ error: "차단한 사용자가 아닙니다." }, { status: 404 });
      }
      console.error("blocked content error:", error);
      return NextResponse.json({ error: "불러오지 못했습니다." }, { status: 500 });
    }
  }

  const rows = await listCommunityBlocks(user.id);
  return NextResponse.json({
    blocks: rows.map((row) => ({
      userId: row.blocked_id,
      nickname: row.nickname || "익명",
      createdAt: row.created_at,
      postCount: row.post_count,
      commentCount: row.comment_count,
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
