import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface CommunityCategoryGroupRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  post_count?: bigint | number;
  tag_count?: bigint | number;
}

export interface CommunityTagRow {
  id: string;
  group_id: string;
  group_name?: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  post_count?: bigint | number;
}

export interface CommunityPollOptionResult {
  id: string;
  text: string;
  sort_order: number;
  votes: number;
}

export interface CommunityPollResult {
  options: CommunityPollOptionResult[];
  totalVotes: number;
  myOptionId: string | null;
}

export interface CommunityPostRow {
  id: string;
  user_id: string | null;
  nickname: string | null;
  group_id: string;
  group_name: string;
  group_slug: string;
  title: string;
  content: string;
  type: string;
  is_blinded: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  tags: CommunityTagRow[];
  images: CommunityPostImageRow[];
  like_count?: bigint | number;
  comment_count?: bigint | number;
  liked_by_me?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  poll?: CommunityPollResult | null;
}

export interface CommunityPostImageRow {
  id: string;
  post_id: string;
  image_url: string;
  sort_order: number;
  created_at: Date;
}

export interface CommunityCommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string | null;
  nickname: string | null;
  content: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  like_count?: bigint | number;
  liked_by_me?: boolean;
}

export interface CommunityCommentNode extends CommunityCommentRow {
  replies: CommunityCommentNode[];
}

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-_\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function ensureCommunityTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityCategoryGroup" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "description" TEXT NOT NULL DEFAULT '',
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityTag" (
      "id" TEXT PRIMARY KEY,
      "group_id" TEXT NOT NULL REFERENCES "CommunityCategoryGroup"("id") ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CommunityTag_group_slug_key"
    ON "CommunityTag" ("group_id", "slug")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityTag_group_sort_idx"
    ON "CommunityTag" ("group_id", "sort_order")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPost" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "group_id" TEXT NOT NULL REFERENCES "CommunityCategoryGroup"("id"),
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPostTag" (
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "tag_id" TEXT NOT NULL REFERENCES "CommunityTag"("id") ON DELETE CASCADE,
      PRIMARY KEY ("post_id", "tag_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPostImage" (
      "id" TEXT PRIMARY KEY,
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "image_url" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityPostImage_post_sort_idx"
    ON "CommunityPostImage" ("post_id", "sort_order", "created_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityComment" (
      "id" TEXT PRIMARY KEY,
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "parent_id" TEXT REFERENCES "CommunityComment"("id") ON DELETE CASCADE,
      "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "content" TEXT NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CommunityComment"
    ADD COLUMN IF NOT EXISTS "parent_id" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'CommunityComment_parent_id_fkey'
      ) THEN
        ALTER TABLE "CommunityComment"
        ADD CONSTRAINT "CommunityComment_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "CommunityComment"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityComment_post_parent_idx"
    ON "CommunityComment" ("post_id", "parent_id", "created_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPostLike" (
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("post_id", "user_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityPostLike_user_idx"
    ON "CommunityPostLike" ("user_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityCommentLike" (
      "comment_id" TEXT NOT NULL REFERENCES "CommunityComment"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("comment_id", "user_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityCommentLike_user_idx"
    ON "CommunityCommentLike" ("user_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityReport" (
      "id" TEXT PRIMARY KEY,
      "post_id" TEXT REFERENCES "CommunityPost"("id") ON DELETE SET NULL,
      "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT '접수',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Post type (normal | poll) and author-chosen image blind ---
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'normal'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "is_blinded" BOOLEAN NOT NULL DEFAULT false
  `);

  // --- Reaction kind for the 6 empathy types (one reaction per user) ---
  // Existing rows default to 'heart' to preserve current likes.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CommunityPostLike" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'heart'
  `);

  // --- Poll options + votes (max 4 options, one vote per user) ---
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPollOption" (
      "id" TEXT PRIMARY KEY,
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "text" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityPollOption_post_idx"
    ON "CommunityPollOption" ("post_id", "sort_order")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPollVote" (
      "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
      "option_id" TEXT NOT NULL REFERENCES "CommunityPollOption"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("post_id", "user_id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommunityPollVote_option_idx"
    ON "CommunityPollVote" ("option_id")
  `);
}

// The 6 supported empathy reactions. Order = display order.
export const COMMUNITY_REACTION_TYPES = ["heart", "sad", "laugh", "smile", "devil", "skull"] as const;
export type CommunityReactionType = (typeof COMMUNITY_REACTION_TYPES)[number];

export function normalizeReactionType(value: unknown): CommunityReactionType {
  return (COMMUNITY_REACTION_TYPES as readonly string[]).includes(String(value))
    ? (String(value) as CommunityReactionType)
    : "heart";
}

export async function seedDefaultCommunityTaxonomy() {
  await ensureCommunityTables();
  const existing = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint AS "count" FROM "CommunityCategoryGroup"`);
  if (Number(existing[0]?.count || 0) > 0) return;

  const groups = [
    { name: "입시", slug: "admission", description: "입시 자료와 뉴스" },
    { name: "학습", slug: "study", description: "과목별 학습과 공부법" },
    { name: "생활", slug: "life", description: "학교생활과 일상" },
    { name: "자유", slug: "free", description: "자유로운 이야기" },
    { name: "공지", slug: "notice", description: "커뮤니티 공지" },
    { name: "자료", slug: "resources", description: "학습 자료 공유" },
    { name: "대학", slug: "university", description: "대학 정보" },
    { name: "취업", slug: "career", description: "진로와 취업" },
  ];
  const tagsByGroup: Record<string, string[]> = {
    admission: ["입시자료", "배치표", "입시뉴스", "입시분석", "수시", "정시", "의대", "치대", "약대", "수의대"],
    study: ["국어", "수학", "영어", "탐구", "공부법", "문제풀이", "오답노트"],
  };

  for (const [index, group] of groups.entries()) {
    const groupId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CommunityCategoryGroup" ("id", "name", "slug", "description", "sort_order") VALUES ($1, $2, $3, $4, $5)`,
      groupId,
      group.name,
      group.slug,
      group.description,
      index
    );
    const tags = tagsByGroup[group.slug] || [];
    for (const [tagIndex, tagName] of tags.entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CommunityTag" ("id", "group_id", "name", "slug", "sort_order") VALUES ($1, $2, $3, $4, $5)`,
        randomUUID(),
        groupId,
        tagName,
        normalizeSlug(tagName) || `tag-${tagIndex + 1}`,
        tagIndex
      );
    }
  }
}

export function toNumber(value: bigint | number | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value || 0;
}

export function mapGroup(row: CommunityCategoryGroupRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    postCount: toNumber(row.post_count),
    tagCount: toNumber(row.tag_count),
  };
}

export function mapTag(row: CommunityTagRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    postCount: toNumber(row.post_count),
  };
}

export async function getCategoryGroups(options: { activeOnly?: boolean } = {}) {
  await seedDefaultCommunityTaxonomy();
  const where = options.activeOnly ? `WHERE g."is_active" = true` : "";
  return prisma.$queryRawUnsafe<CommunityCategoryGroupRow[]>(`
    SELECT
      g.*,
      COALESCE(p."post_count", 0) AS "post_count",
      COALESCE(t."tag_count", 0) AS "tag_count"
    FROM "CommunityCategoryGroup" g
    LEFT JOIN (
      SELECT "group_id", COUNT(*) AS "post_count"
      FROM "CommunityPost"
      GROUP BY "group_id"
    ) p ON p."group_id" = g."id"
    LEFT JOIN (
      SELECT "group_id", COUNT(*) AS "tag_count"
      FROM "CommunityTag"
      GROUP BY "group_id"
    ) t ON t."group_id" = g."id"
    ${where}
    ORDER BY g."sort_order" ASC, g."created_at" ASC
  `);
}

export async function getTags(options: { groupId?: string | null; activeOnly?: boolean } = {}) {
  await seedDefaultCommunityTaxonomy();
  const conditions = [];
  const params: unknown[] = [];
  if (options.groupId) {
    params.push(options.groupId);
    conditions.push(`t."group_id" = $${params.length}`);
  }
  if (options.activeOnly) {
    conditions.push(`t."is_active" = true`);
    conditions.push(`g."is_active" = true`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return prisma.$queryRawUnsafe<CommunityTagRow[]>(
    `
      SELECT
        t.*,
        g."name" AS "group_name",
        COALESCE(pt."post_count", 0) AS "post_count"
      FROM "CommunityTag" t
      JOIN "CommunityCategoryGroup" g ON g."id" = t."group_id"
      LEFT JOIN (
        SELECT "tag_id", COUNT(*) AS "post_count"
        FROM "CommunityPostTag"
        GROUP BY "tag_id"
      ) pt ON pt."tag_id" = t."id"
      ${where}
      ORDER BY g."sort_order" ASC, t."sort_order" ASC, t."created_at" ASC
    `,
    ...params
  );
}

export async function createCategoryGroup(input: { name: string; slug: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  await ensureCommunityTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CommunityCategoryGroup" ("id", "name", "slug", "description", "is_active", "sort_order")
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    id,
    input.name,
    input.slug,
    input.description || "",
    input.isActive ?? true,
    input.sortOrder ?? 0
  );
  return id;
}

export async function updateCategoryGroup(id: string, input: { name: string; slug: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "CommunityCategoryGroup"
      SET "name" = $2, "slug" = $3, "description" = $4, "is_active" = $5, "sort_order" = $6, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    id,
    input.name,
    input.slug,
    input.description || "",
    input.isActive ?? true,
    input.sortOrder ?? 0
  );
}

export async function deleteOrDeactivateCategoryGroup(id: string) {
  await ensureCommunityTables();
  const linked = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint AS "count" FROM "CommunityPost" WHERE "group_id" = $1`, id);
  if (Number(linked[0]?.count || 0) > 0) {
    await prisma.$executeRawUnsafe(`UPDATE "CommunityCategoryGroup" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`, id);
    return { deleted: false, deactivated: true };
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityCategoryGroup" WHERE "id" = $1`, id);
  return { deleted: true, deactivated: false };
}

export async function createTag(input: { groupId: string; name: string; slug: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  await ensureCommunityTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CommunityTag" ("id", "group_id", "name", "slug", "description", "is_active", "sort_order")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    id,
    input.groupId,
    input.name,
    input.slug,
    input.description || "",
    input.isActive ?? true,
    input.sortOrder ?? 0
  );
  return id;
}

export async function updateTag(id: string, input: { groupId: string; name: string; slug: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "CommunityTag"
      SET "group_id" = $2, "name" = $3, "slug" = $4, "description" = $5, "is_active" = $6, "sort_order" = $7, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    id,
    input.groupId,
    input.name,
    input.slug,
    input.description || "",
    input.isActive ?? true,
    input.sortOrder ?? 0
  );
}

export async function deleteOrDeactivateTag(id: string) {
  await ensureCommunityTables();
  const linked = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint AS "count" FROM "CommunityPostTag" WHERE "tag_id" = $1`, id);
  if (Number(linked[0]?.count || 0) > 0) {
    await prisma.$executeRawUnsafe(`UPDATE "CommunityTag" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`, id);
    return { deleted: false, deactivated: true };
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityTag" WHERE "id" = $1`, id);
  return { deleted: true, deactivated: false };
}

export async function reorderCategoryGroups(items: { id: string; sortOrder: number }[]) {
  await ensureCommunityTables();
  for (const item of items) {
    await prisma.$executeRawUnsafe(`UPDATE "CommunityCategoryGroup" SET "sort_order" = $2, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`, item.id, item.sortOrder);
  }
}

export async function reorderTags(items: { id: string; sortOrder: number }[]) {
  await ensureCommunityTables();
  for (const item of items) {
    await prisma.$executeRawUnsafe(`UPDATE "CommunityTag" SET "sort_order" = $2, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`, item.id, item.sortOrder);
  }
}

export async function getCommunityPosts(options: { activeOnly?: boolean; groupId?: string | null; tagId?: string | null; query?: string | null } = {}) {
  await seedDefaultCommunityTaxonomy();
  const conditions = [];
  const params: unknown[] = [];
  if (options.activeOnly) {
    conditions.push(`p."is_active" = true`);
    conditions.push(`g."is_active" = true`);
  }
  if (options.groupId) {
    params.push(options.groupId);
    conditions.push(`p."group_id" = $${params.length}`);
  }
  if (options.tagId) {
    params.push(options.tagId);
    conditions.push(`EXISTS (SELECT 1 FROM "CommunityPostTag" x WHERE x."post_id" = p."id" AND x."tag_id" = $${params.length})`);
  }
  if (options.query) {
    params.push(`%${options.query}%`);
    conditions.push(`(p."title" ILIKE $${params.length} OR p."content" ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const posts = await prisma.$queryRawUnsafe<Omit<CommunityPostRow, "tags" | "images">[]>(
    `
      SELECT
        p.*,
        u."nickname",
        g."name" AS "group_name",
        g."slug" AS "group_slug",
        COALESCE(pl."like_count", 0) AS "like_count",
        COALESCE(cc."comment_count", 0) AS "comment_count"
      FROM "CommunityPost" p
      JOIN "CommunityCategoryGroup" g ON g."id" = p."group_id"
      LEFT JOIN "User" u ON u."id" = p."user_id"
      LEFT JOIN (
        SELECT "post_id", COUNT(*)::bigint AS "like_count"
        FROM "CommunityPostLike"
        GROUP BY "post_id"
      ) pl ON pl."post_id" = p."id"
      LEFT JOIN (
        SELECT "post_id", COUNT(*)::bigint AS "comment_count"
        FROM "CommunityComment"
        WHERE "is_active" = true
        GROUP BY "post_id"
      ) cc ON cc."post_id" = p."id"
      ${where}
      ORDER BY p."created_at" DESC
      LIMIT 100
    `,
    ...params
  );
  const tags = await getTags({ activeOnly: options.activeOnly });
  const tagsByPost = await prisma.$queryRawUnsafe<{ post_id: string; tag_id: string }[]>(`
    SELECT "post_id", "tag_id" FROM "CommunityPostTag"
  `);
  const imagesByPost = await getImagesByPost(posts.map((post) => post.id));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  return posts.map((post) => ({
    ...post,
    tags: tagsByPost
      .filter((item) => item.post_id === post.id)
      .map((item) => tagById.get(item.tag_id))
      .filter(Boolean) as CommunityTagRow[],
    images: imagesByPost.get(post.id) || [],
  }));
}

async function getImagesByPost(postIds: string[]) {
  const imagesByPost = new Map<string, CommunityPostImageRow[]>();
  if (postIds.length === 0) return imagesByPost;
  const placeholders = postIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<CommunityPostImageRow[]>(
    `
      SELECT *
      FROM "CommunityPostImage"
      WHERE "post_id" IN (${placeholders})
      ORDER BY "sort_order" ASC, "created_at" ASC
    `,
    ...postIds
  );
  for (const row of rows) {
    const images = imagesByPost.get(row.post_id) || [];
    images.push(row);
    imagesByPost.set(row.post_id, images);
  }
  return imagesByPost;
}

export async function createCommunityPost(input: {
  userId: string | null;
  groupId: string;
  title: string;
  content: string;
  tagIds: string[];
  imageUrls?: string[];
  isBlinded?: boolean;
  type?: string;
  pollOptions?: string[];
}) {
  await ensureCommunityTables();
  const id = randomUUID();
  const isPoll = input.type === "poll";
  const pollOptions = (input.pollOptions || [])
    .map((t) => String(t || "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 4);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CommunityPost" ("id", "user_id", "group_id", "title", "content", "type", "is_blinded") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    id,
    input.userId,
    input.groupId,
    input.title,
    input.content,
    isPoll ? "poll" : "normal",
    !!input.isBlinded
  );
  if (isPoll) {
    for (const [index, text] of pollOptions.entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CommunityPollOption" ("id", "post_id", "text", "sort_order") VALUES ($1, $2, $3, $4)`,
        randomUUID(),
        id,
        text,
        index
      );
    }
  }
  for (const tagId of input.tagIds) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CommunityPostTag" ("post_id", "tag_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      id,
      tagId
    );
  }
  for (const [index, imageUrl] of (input.imageUrls || []).entries()) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CommunityPostImage" ("id", "post_id", "image_url", "sort_order")
        VALUES ($1, $2, $3, $4)
      `,
      randomUUID(),
      id,
      imageUrl,
      index
    );
  }
  return id;
}

export async function getCommunityPostDetail(
  postId: string,
  options: { activeOnly?: boolean; viewerId?: string | null } = {}
) {
  await seedDefaultCommunityTaxonomy();
  const viewerId = options.viewerId || null;
  const postConditions = [`p."id" = $1`];
  if (options.activeOnly) {
    postConditions.push(`p."is_active" = true`);
    postConditions.push(`g."is_active" = true`);
  }

  const postRows = await prisma.$queryRawUnsafe<Omit<CommunityPostRow, "tags" | "images">[]>(
    `
      SELECT
        p.*,
        u."nickname",
        g."name" AS "group_name",
        g."slug" AS "group_slug",
        COALESCE(pl."like_count", 0) AS "like_count",
        COALESCE(cc."comment_count", 0) AS "comment_count",
        EXISTS (
          SELECT 1
          FROM "CommunityPostLike" x
          WHERE x."post_id" = p."id" AND x."user_id" = $2
        ) AS "liked_by_me"
      FROM "CommunityPost" p
      JOIN "CommunityCategoryGroup" g ON g."id" = p."group_id"
      LEFT JOIN "User" u ON u."id" = p."user_id"
      LEFT JOIN (
        SELECT "post_id", COUNT(*)::bigint AS "like_count"
        FROM "CommunityPostLike"
        GROUP BY "post_id"
      ) pl ON pl."post_id" = p."id"
      LEFT JOIN (
        SELECT "post_id", COUNT(*)::bigint AS "comment_count"
        FROM "CommunityComment"
        WHERE "is_active" = true
        GROUP BY "post_id"
      ) cc ON cc."post_id" = p."id"
      WHERE ${postConditions.join(" AND ")}
      LIMIT 1
    `,
    postId,
    viewerId
  );

  const post = postRows[0];
  if (!post) return null;

  const tagConditions = [`pt."post_id" = $1`];
  if (options.activeOnly) {
    tagConditions.push(`t."is_active" = true`);
    tagConditions.push(`g."is_active" = true`);
  }
  const tags = await prisma.$queryRawUnsafe<CommunityTagRow[]>(
    `
      SELECT
        t.*,
        g."name" AS "group_name",
        0::bigint AS "post_count"
      FROM "CommunityPostTag" pt
      JOIN "CommunityTag" t ON t."id" = pt."tag_id"
      JOIN "CommunityCategoryGroup" g ON g."id" = t."group_id"
      WHERE ${tagConditions.join(" AND ")}
      ORDER BY t."sort_order" ASC, t."created_at" ASC
    `,
    postId
  );
  const imagesByPost = await getImagesByPost([postId]);
  const reactions = await getPostReactions(postId, viewerId);
  const poll = post.type === "poll" ? await getPollResult(postId, viewerId) : null;

  const commentConditions = [`c."post_id" = $1`];
  if (options.activeOnly) commentConditions.push(`c."is_active" = true`);
  const commentRows = await prisma.$queryRawUnsafe<CommunityCommentRow[]>(
    `
      SELECT
        c.*,
        u."nickname",
        COALESCE(cl."like_count", 0) AS "like_count",
        EXISTS (
          SELECT 1
          FROM "CommunityCommentLike" x
          WHERE x."comment_id" = c."id" AND x."user_id" = $2
        ) AS "liked_by_me"
      FROM "CommunityComment" c
      LEFT JOIN "User" u ON u."id" = c."user_id"
      LEFT JOIN (
        SELECT "comment_id", COUNT(*)::bigint AS "like_count"
        FROM "CommunityCommentLike"
        GROUP BY "comment_id"
      ) cl ON cl."comment_id" = c."id"
      WHERE ${commentConditions.join(" AND ")}
      ORDER BY c."created_at" ASC
    `,
    postId,
    viewerId
  );

  return {
    post: {
      ...post,
      tags,
      images: imagesByPost.get(postId) || [],
      reaction_counts: reactions.counts,
      my_reaction: reactions.myReaction,
      poll,
    },
    comments: buildCommentTree(commentRows),
  };
}

function buildCommentTree(rows: CommunityCommentRow[]) {
  const byId = new Map<string, CommunityCommentNode>();
  const roots: CommunityCommentNode[] = [];

  for (const row of rows) {
    byId.set(row.id, { ...row, replies: [] });
  }

  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function assertActiveCommunityPost(postId: string) {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `
      SELECT COUNT(*)::bigint AS "count"
      FROM "CommunityPost" p
      JOIN "CommunityCategoryGroup" g ON g."id" = p."group_id"
      WHERE p."id" = $1 AND p."is_active" = true AND g."is_active" = true
    `,
    postId
  );
  if (Number(rows[0]?.count || 0) === 0) {
    throw new Error("CommunityPostNotFound");
  }
}

export async function createCommunityComment(input: {
  postId: string;
  userId: string;
  parentId?: string | null;
  content: string;
}) {
  await ensureCommunityTables();
  await assertActiveCommunityPost(input.postId);

  let parentId = input.parentId || null;
  if (parentId) {
    const parents = await prisma.$queryRawUnsafe<{ id: string; parent_id: string | null }[]>(
      `
        SELECT "id", "parent_id"
        FROM "CommunityComment"
        WHERE "id" = $1 AND "post_id" = $2 AND "is_active" = true
        LIMIT 1
      `,
      parentId,
      input.postId
    );
    const parent = parents[0];
    if (!parent) throw new Error("CommunityParentCommentNotFound");
    parentId = parent.parent_id || parent.id;
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CommunityComment" ("id", "post_id", "parent_id", "user_id", "content")
      VALUES ($1, $2, $3, $4, $5)
    `,
    id,
    input.postId,
    parentId,
    input.userId,
    input.content
  );
  return id;
}

export async function toggleCommunityPostLike(postId: string, userId: string) {
  await ensureCommunityTables();
  await assertActiveCommunityPost(postId);

  const existing = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "CommunityPostLike" WHERE "post_id" = $1 AND "user_id" = $2`,
    postId,
    userId
  );
  const liked = Number(existing[0]?.count || 0) === 0;
  if (liked) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CommunityPostLike" ("post_id", "user_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      postId,
      userId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CommunityPostLike" WHERE "post_id" = $1 AND "user_id" = $2`,
      postId,
      userId
    );
  }

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "CommunityPostLike" WHERE "post_id" = $1`,
    postId
  );
  return { liked, likeCount: Number(countRows[0]?.count || 0) };
}

export async function toggleCommunityCommentLike(commentId: string, userId: string) {
  await ensureCommunityTables();
  const comments = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
      SELECT c."id"
      FROM "CommunityComment" c
      JOIN "CommunityPost" p ON p."id" = c."post_id"
      JOIN "CommunityCategoryGroup" g ON g."id" = p."group_id"
      WHERE c."id" = $1
        AND c."is_active" = true
        AND p."is_active" = true
        AND g."is_active" = true
      LIMIT 1
    `,
    commentId
  );
  if (!comments[0]) throw new Error("CommunityCommentNotFound");

  const existing = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "CommunityCommentLike" WHERE "comment_id" = $1 AND "user_id" = $2`,
    commentId,
    userId
  );
  const liked = Number(existing[0]?.count || 0) === 0;
  if (liked) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CommunityCommentLike" ("comment_id", "user_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      commentId,
      userId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CommunityCommentLike" WHERE "comment_id" = $1 AND "user_id" = $2`,
      commentId,
      userId
    );
  }

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "CommunityCommentLike" WHERE "comment_id" = $1`,
    commentId
  );
  return { liked, likeCount: Number(countRows[0]?.count || 0) };
}

/* ----------------------------- Admin moderation ---------------------------- */

// 게시글 수정 (관리자): 전달된 필드만 갱신한다.
export async function adminUpdateCommunityPost(
  id: string,
  input: { title?: string; content?: string; groupId?: string; isActive?: boolean }
) {
  await ensureCommunityTables();
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.title !== undefined) {
    sets.push(`"title" = $${i++}`);
    values.push(input.title);
  }
  if (input.content !== undefined) {
    sets.push(`"content" = $${i++}`);
    values.push(input.content);
  }
  if (input.groupId !== undefined) {
    sets.push(`"group_id" = $${i++}`);
    values.push(input.groupId);
  }
  if (input.isActive !== undefined) {
    sets.push(`"is_active" = $${i++}`);
    values.push(input.isActive);
  }
  if (sets.length === 0) return;
  sets.push(`"updated_at" = CURRENT_TIMESTAMP`);
  values.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "CommunityPost" SET ${sets.join(", ")} WHERE "id" = $${i}`,
    ...values
  );
}

// 게시글 노출/비노출 토글 (관리자): 되돌릴 수 있는 소프트 처리.
export async function adminSetCommunityPostActive(id: string, isActive: boolean) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "CommunityPost" SET "is_active" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2`,
    isActive,
    id
  );
}

// 게시글 영구 삭제 (관리자): 자식(태그/이미지/댓글/좋아요)은 ON DELETE CASCADE로 함께 삭제된다.
export async function adminDeleteCommunityPost(id: string) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityPost" WHERE "id" = $1`, id);
}

export interface AdminCommentRow {
  id: string;
  post_id: string;
  post_title: string;
  parent_id: string | null;
  user_id: string | null;
  nickname: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
}

// 댓글 목록 (관리자): 최신순, 게시글 제목 포함.
export async function getAdminComments(options: { limit?: number } = {}) {
  await ensureCommunityTables();
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  return prisma.$queryRawUnsafe<AdminCommentRow[]>(
    `
      SELECT
        c."id",
        c."post_id",
        p."title" AS "post_title",
        c."parent_id",
        c."user_id",
        u."nickname",
        c."content",
        c."is_active",
        c."created_at"
      FROM "CommunityComment" c
      JOIN "CommunityPost" p ON p."id" = c."post_id"
      LEFT JOIN "User" u ON u."id" = c."user_id"
      ORDER BY c."created_at" DESC
      LIMIT ${limit}
    `
  );
}

// 댓글 노출/비노출 토글 (관리자).
export async function adminSetCommunityCommentActive(id: string, isActive: boolean) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "CommunityComment" SET "is_active" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2`,
    isActive,
    id
  );
}

// 댓글 영구 삭제 (관리자): 대댓글/좋아요는 ON DELETE CASCADE로 함께 삭제된다.
export async function adminDeleteCommunityComment(id: string) {
  await ensureCommunityTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityComment" WHERE "id" = $1`, id);
}

/* --------------------------- Reactions (6 types) --------------------------- */

// 게시글 공감 집계 + 내 공감.
export async function getPostReactions(postId: string, viewerId?: string | null) {
  const rows = await prisma.$queryRawUnsafe<{ type: string; n: bigint }[]>(
    `SELECT "type", COUNT(*)::bigint AS n FROM "CommunityPostLike" WHERE "post_id" = $1 GROUP BY "type"`,
    postId
  );
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n);
    counts[r.type] = n;
    total += n;
  }
  let myReaction: string | null = null;
  if (viewerId) {
    const mine = await prisma.$queryRawUnsafe<{ type: string }[]>(
      `SELECT "type" FROM "CommunityPostLike" WHERE "post_id" = $1 AND "user_id" = $2 LIMIT 1`,
      postId,
      viewerId
    );
    myReaction = mine[0]?.type ?? null;
  }
  return { counts, total, myReaction };
}

// 공감 설정: type=null이면 해제, 아니면 1인 1개로 교체(upsert).
export async function setCommunityPostReaction(
  postId: string,
  userId: string,
  type: string | null
) {
  await ensureCommunityTables();
  await assertActiveCommunityPost(postId);
  if (type === null) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CommunityPostLike" WHERE "post_id" = $1 AND "user_id" = $2`,
      postId,
      userId
    );
  } else {
    const t = normalizeReactionType(type);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CommunityPostLike" ("post_id", "user_id", "type") VALUES ($1, $2, $3)
       ON CONFLICT ("post_id", "user_id") DO UPDATE SET "type" = EXCLUDED."type"`,
      postId,
      userId,
      t
    );
  }
  const r = await getPostReactions(postId, userId);
  // `liked`/`likeCount` kept for backward compatibility with older callers.
  return { myReaction: r.myReaction, counts: r.counts, total: r.total, liked: r.myReaction !== null, likeCount: r.total };
}

/* -------------------------------- Polls ----------------------------------- */

export async function getPollResult(
  postId: string,
  viewerId?: string | null
): Promise<CommunityPollResult | null> {
  const opts = await prisma.$queryRawUnsafe<
    { id: string; text: string; sort_order: number; votes: bigint }[]
  >(
    `
      SELECT o."id", o."text", o."sort_order", COALESCE(v."cnt", 0)::bigint AS "votes"
      FROM "CommunityPollOption" o
      LEFT JOIN (
        SELECT "option_id", COUNT(*) AS "cnt" FROM "CommunityPollVote" GROUP BY "option_id"
      ) v ON v."option_id" = o."id"
      WHERE o."post_id" = $1
      ORDER BY o."sort_order" ASC
    `,
    postId
  );
  if (opts.length === 0) return null;
  let myOptionId: string | null = null;
  if (viewerId) {
    const mine = await prisma.$queryRawUnsafe<{ option_id: string }[]>(
      `SELECT "option_id" FROM "CommunityPollVote" WHERE "post_id" = $1 AND "user_id" = $2 LIMIT 1`,
      postId,
      viewerId
    );
    myOptionId = mine[0]?.option_id ?? null;
  }
  const options = opts.map((o) => ({
    id: o.id,
    text: o.text,
    sort_order: o.sort_order,
    votes: Number(o.votes),
  }));
  const totalVotes = options.reduce((s, o) => s + o.votes, 0);
  return { options, totalVotes, myOptionId };
}

// 투표(1인 1표): 이미 투표했으면 선택을 변경한다.
export async function voteCommunityPoll(postId: string, userId: string, optionId: string) {
  await ensureCommunityTables();
  await assertActiveCommunityPost(postId);
  const valid = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM "CommunityPollOption" WHERE "id" = $1 AND "post_id" = $2`,
    optionId,
    postId
  );
  if (Number(valid[0]?.count || 0) === 0) throw new Error("CommunityPollOptionNotFound");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CommunityPollVote" ("post_id", "user_id", "option_id") VALUES ($1, $2, $3)
     ON CONFLICT ("post_id", "user_id") DO UPDATE SET "option_id" = EXCLUDED."option_id"`,
    postId,
    userId,
    optionId
  );
  return getPollResult(postId, userId);
}
