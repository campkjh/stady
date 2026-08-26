import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createCommunityComment,
  getCommunityComments,
  toNumber,
  type CommentSort,
  type CommunityCommentNode,
} from "@/lib/community";

const SORTS: CommentSort[] = ["popular", "recommended", "newest", "oldest"];

// 목록의 댓글 모달용 — 상세 진입 없이 한 글의 댓글 트리를 내려준다.
function mapComment(c: CommunityCommentNode): unknown {
  return {
    id: c.id,
    userId: c.user_id,
    parentId: c.parent_id,
    nickname: c.nickname || "익명",
    avatar: c.user_id && c.has_avatar ? `/api/community/avatar/${c.user_id}` : null,
    content: c.content,
    createdAt: c.created_at,
    likeCount: toNumber(c.like_count ?? 0),
    likedByMe: Boolean(c.liked_by_me),
    replies: c.replies.map(mapComment),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const viewer = await getCurrentUser();
    const sortRaw = new URL(request.url).searchParams.get("sort") as CommentSort | null;
    const sort: CommentSort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "popular";
    const comments = await getCommunityComments(postId, viewer?.id ?? null, true, sort);
    return NextResponse.json({
      comments: comments.map(mapComment),
      currentUserId: viewer?.id ?? null,
    });
  } catch (error) {
    console.error("Community comments GET error:", error);
    return NextResponse.json({ error: "댓글을 불러오지 못했습니다." }, { status: 500 });
  }
}

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (error.message === "CommunityParentCommentNotFound") {
      return NextResponse.json({ error: "답글을 달 댓글을 찾을 수 없습니다." }, { status: 404 });
    }
  }
  console.error("Community comment POST error:", error);
  return NextResponse.json({ error: "댓글을 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await request.json();
    const content = String(body.content || "").trim();
    const parentId = body.parentId ? String(body.parentId) : null;

    if (!content) {
      return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
    }

    const id = await createCommunityComment({
      postId,
      userId: user.id,
      parentId,
      content,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
