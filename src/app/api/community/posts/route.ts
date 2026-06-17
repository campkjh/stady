import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCommunityPost, getCommunityPosts, getTags, mapTag, toNumber } from "@/lib/community";

function mapPost(post: Awaited<ReturnType<typeof getCommunityPosts>>[number]) {
  return {
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
    likeCount: toNumber(post.like_count),
    commentCount: toNumber(post.comment_count),
    imageUrls: post.images.map((image) => image.image_url),
    tags: post.tags.map(mapTag),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const posts = await getCommunityPosts({
      activeOnly: true,
      groupId: searchParams.get("groupId"),
      tagId: searchParams.get("tagId"),
      query: searchParams.get("q"),
    });
    return NextResponse.json({ posts: posts.map(mapPost) });
  } catch (error) {
    console.error("Community posts GET error:", error);
    return NextResponse.json({ error: "게시글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const groupId = String(body.groupId || "");
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const requestedTagIds: string[] = Array.isArray(body.tagIds)
      ? body.tagIds.map((tagId: unknown) => String(tagId))
      : [];
    const imageUrls: string[] = Array.isArray(body.imageUrls)
      ? body.imageUrls
          .map((imageUrl: unknown) => String(imageUrl || "").trim())
          .filter((imageUrl: string) => /^https?:\/\//.test(imageUrl))
          .slice(0, 5)
      : [];

    if (!groupId || !title || !content) {
      return NextResponse.json({ error: "카테고리, 제목, 내용을 입력해주세요." }, { status: 400 });
    }

    const activeTags = await getTags({ groupId, activeOnly: true });
    const activeTagIds = new Set(activeTags.map((tag) => tag.id));
    const tagIds = requestedTagIds.filter((tagId) => activeTagIds.has(tagId));

    const id = await createCommunityPost({
      userId: user.id,
      groupId,
      title,
      content,
      tagIds,
      imageUrls,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Community posts POST error:", error);
    return NextResponse.json({ error: "게시글을 저장하지 못했습니다." }, { status: 500 });
  }
}
