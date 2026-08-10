import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setPinnedComment } from "@/lib/community";

/** 글쓴이(또는 관리자)가 댓글 하나를 상단 고정. { commentId: null }이면 해제. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const commentId = body?.commentId ? String(body.commentId) : null;
    const result = await setPinnedComment(id, user.id, commentId, user.role === "admin");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (message === "CommunityCommentNotFound") {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (message === "CommunityCommentNotPinnable") {
      return NextResponse.json({ error: "답글은 고정할 수 없습니다." }, { status: 400 });
    }
    if (message === "CommunityForbidden") {
      return NextResponse.json({ error: "글쓴이만 댓글을 고정할 수 있습니다." }, { status: 403 });
    }
    console.error("Community pin POST error:", error);
    return NextResponse.json({ error: "댓글 고정을 처리하지 못했습니다." }, { status: 500 });
  }
}
