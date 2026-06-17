import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCommunityPosts, mapTag } from "@/lib/community";

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin community posts API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const posts = await getCommunityPosts({ activeOnly: false });
    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        userId: post.user_id,
        nickname: post.nickname || "익명",
        groupId: post.group_id,
        groupName: post.group_name,
        groupSlug: post.group_slug,
        title: post.title,
        content: post.content,
        isActive: post.is_active,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        tags: post.tags.map(mapTag),
      })),
    });
  } catch (error) {
    return adminError(error);
  }
}
