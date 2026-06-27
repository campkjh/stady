import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  CommunityCommentNode,
  getCommunityPostDetail,
  getCommunityPostOwnerId,
  adminUpdateCommunityPost,
  adminDeleteCommunityPost,
  setCommunityPostImages,
  incrementCommunityPostView,
  mapTag,
  toNumber,
} from "@/lib/community";

// 본인 글이거나 관리자면 통과. { ok } 또는 에러 응답을 반환.
async function authorizePostMutation(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  const ownerId = await getCommunityPostOwnerId(id);
  if (ownerId === undefined) {
    return { error: NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 }) };
  }
  const isOwner = ownerId !== null && ownerId === user.id;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true as const };
}

function mapComment(comment: CommunityCommentNode): unknown {
  return {
    id: comment.id,
    postId: comment.post_id,
    parentId: comment.parent_id,
    userId: comment.user_id,
    nickname: comment.nickname || "익명",
    content: comment.content,
    isActive: comment.is_active,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    likeCount: toNumber(comment.like_count),
    likedByMe: Boolean(comment.liked_by_me),
    replies: comment.replies.map(mapComment),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    // 글 상세 최초 진입(track=1)에서만 조회수 +1. 좋아요/댓글 후 재조회 땐 증가 안 함.
    if (new URL(request.url).searchParams.get("track") === "1") {
      await incrementCommunityPostView(id);
    }
    const detail = await getCommunityPostDetail(id, {
      activeOnly: true,
      viewerId: user?.id,
    });

    if (!detail) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      post: {
        id: detail.post.id,
        userId: detail.post.user_id,
        nickname: detail.post.nickname || "익명",
        groupId: detail.post.group_id,
        groupName: detail.post.group_name,
        groupSlug: detail.post.group_slug,
        title: detail.post.title,
        content: detail.post.content,
        type: detail.post.type,
        isBlinded: detail.post.is_blinded,
        isActive: detail.post.is_active,
        createdAt: detail.post.created_at,
        updatedAt: detail.post.updated_at,
        viewCount: toNumber(detail.post.view_count),
        likeCount: toNumber(detail.post.like_count),
        commentCount: toNumber(detail.post.comment_count),
        likedByMe: Boolean(detail.post.liked_by_me),
        reactionCounts: detail.post.reaction_counts || {},
        myReaction: detail.post.my_reaction ?? null,
        poll: detail.post.poll ?? null,
        imageUrls: detail.post.images.map((image) => image.image_url),
        tags: detail.post.tags.map(mapTag),
      },
      comments: detail.comments.map(mapComment),
    });
  } catch (error) {
    console.error("Community post detail GET error:", error);
    return NextResponse.json({ error: "게시글 상세를 불러오지 못했습니다." }, { status: 500 });
  }
}

// 본인 글 수정 (제목/내용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizePostMutation(id);
    if (auth.error) return auth.error;

    const body = await request.json();
    const title = body?.title !== undefined ? String(body.title).trim() : undefined;
    const content = body?.content !== undefined ? String(body.content).trim() : undefined;
    const imageUrls: string[] | undefined = Array.isArray(body?.imageUrls)
      ? body.imageUrls
          .map((u: unknown) => String(u || "").trim())
          .filter((u: string) => /^https?:\/\//.test(u))
          .slice(0, 5)
      : undefined;
    if (title !== undefined && title.length === 0) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }
    if (content !== undefined && content.length === 0) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }
    if (title === undefined && content === undefined && imageUrls === undefined) {
      return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
    }

    if (title !== undefined || content !== undefined) {
      await adminUpdateCommunityPost(id, {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
      });
    }
    if (imageUrls !== undefined) {
      await setCommunityPostImages(id, imageUrls);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Community post PATCH error:", error);
    return NextResponse.json({ error: "게시글 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// 본인 글 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizePostMutation(id);
    if (auth.error) return auth.error;

    await adminDeleteCommunityPost(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Community post DELETE error:", error);
    return NextResponse.json({ error: "게시글 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
