import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createCommunityPost, ensureCommunityTables } from "@/lib/community";
import { getMirroredPostId, setMirroredPostId, clearMirroredPost } from "@/lib/siteContent";

// 공지사항을 커뮤니티 '공지' 게시판에도 올려, 일반 사용자가 공감/댓글을 달 수 있게 한다.
// 공지 본문(SiteContent)이 원본이고 커뮤니티 글은 미러다 — 수정/삭제도 함께 반영한다.
const NOTICE_GROUP_NAME = "공지";

async function noticeGroupId(): Promise<string | null> {
  await ensureCommunityTables();
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "CommunityCategoryGroup" WHERE "name" = $1 LIMIT 1`,
    NOTICE_GROUP_NAME
  );
  return rows[0]?.id ?? null;
}

/** 공지 생성/수정 시 커뮤니티 미러 글을 만들거나 갱신한다. 실패해도 공지 자체는 유지. */
export async function syncNoticeToCommunity(input: {
  contentId: string;
  title: string;
  body: string;
  imageUrls?: string[];
  authorId: string | null;
  isActive: boolean;
}): Promise<string | null> {
  try {
    const existing = await getMirroredPostId(input.contentId);

    // 비노출 공지는 커뮤니티에서도 내린다(글 자체는 남기되 비활성).
    if (!input.isActive) {
      if (existing) {
        await prisma.$executeRawUnsafe(
          `UPDATE "CommunityPost" SET "is_active" = false WHERE "id" = $1`,
          existing
        );
      }
      return existing;
    }

    if (existing) {
      await prisma.$executeRawUnsafe(
        `UPDATE "CommunityPost" SET "title" = $1, "content" = $2, "is_active" = true, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $3`,
        input.title,
        input.body,
        existing
      );
      // 이미지도 원본 공지 기준으로 교체.
      await prisma.$executeRawUnsafe(`DELETE FROM "CommunityPostImage" WHERE "post_id" = $1`, existing);
      const urls = input.imageUrls ?? [];
      for (let i = 0; i < urls.length; i++) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "CommunityPostImage" ("id","post_id","image_url","sort_order") VALUES ($1,$2,$3,$4)`,
          randomUUID(),
          existing,
          urls[i],
          i
        );
      }
      return existing;
    }

    const groupId = await noticeGroupId();
    if (!groupId) return null;
    const postId = await createCommunityPost({
      userId: input.authorId,
      groupId,
      title: input.title,
      content: input.body,
      tagIds: [],
      imageUrls: input.imageUrls ?? [],
    });
    await setMirroredPostId(input.contentId, postId);
    return postId;
  } catch (error) {
    console.error("Notice → community mirror error:", error);
    return null;
  }
}

/** 공지 삭제 시 커뮤니티 미러 글도 함께 삭제한다. */
export async function removeNoticeMirror(contentId: string): Promise<void> {
  try {
    const postId = await getMirroredPostId(contentId);
    if (postId) {
      await prisma.$executeRawUnsafe(`DELETE FROM "CommunityPost" WHERE "id" = $1`, postId);
    }
    await clearMirroredPost(contentId);
  } catch (error) {
    console.error("Notice mirror delete error:", error);
  }
}
