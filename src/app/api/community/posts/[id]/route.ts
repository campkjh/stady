import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  CommunityCommentNode,
  getCommunityPostDetail,
  mapTag,
  toNumber,
} from "@/lib/community";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
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
