import { NextResponse } from "next/server";
import { getCurrentUser, getAdminUserIds } from "@/lib/auth";
import { getCommunityUserProfile, getUserTiers, getCommunityKings } from "@/lib/community";

export const dynamic = "force-dynamic";

// 유저 프로필 화면(글·댓글 작성자를 누르면 열린다) — 공개 정보만: 닉네임·사진·등급·배지·팔로워 수·최근 활동.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getCurrentUser();
    const profile = await getCommunityUserProfile(id, viewer?.id ?? null);
    if (!profile) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    const tiers = await getUserTiers([id]);
    const kings = await getCommunityKings([id]);
    const adminIds = await getAdminUserIds([id]);
    return NextResponse.json({
      user: {
        id: profile.user.id,
        nickname: profile.user.nickname || "익명",
        avatar: profile.user.has_avatar ? `/api/community/avatar/${profile.user.id}` : null,
        tier: tiers[id] ?? "iron",
        isAdmin: adminIds.has(id),
        isAnswerKing: kings.answer.has(id),
        isPickKing: kings.pick.has(id),
        isMe: viewer?.id === id,
      },
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      isFollowing: profile.isFollowing,
      isBlocked: profile.isBlocked,
      posts: profile.posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        groupName: post.group_name,
        createdAt: post.created_at,
        likeCount: post.like_count,
        commentCount: post.comment_count,
      })),
      comments: profile.comments.map((comment) => ({
        id: comment.id,
        postId: comment.post_id,
        postTitle: comment.post_title || "게시글",
        content: comment.content,
        createdAt: comment.created_at,
        likeCount: comment.like_count,
      })),
    });
  } catch (error) {
    console.error("Community user profile GET error:", error);
    return NextResponse.json({ error: "프로필을 불러오지 못했습니다." }, { status: 500 });
  }
}
