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

export interface CommunityPostRow {
  id: string;
  user_id: string | null;
  nickname: string | null;
  group_id: string;
  group_name: string;
  group_slug: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  tags: CommunityTagRow[];
  images: CommunityPostImageRow[];
  like_count?: bigint | number;
  comment_count?: bigint | number;
  liked_by_me?: boolean;
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

export async function createCommunityPost(input: { userId: string | null; groupId: string; title: string; content: string; tagIds: string[]; imageUrls?: string[] }) {
  await ensureCommunityTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CommunityPost" ("id", "user_id", "group_id", "title", "content") VALUES ($1, $2, $3, $4, $5)`,
    id,
    input.userId,
    input.groupId,
    input.title,
    input.content
  );
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
    post: { ...post, tags, images: imagesByPost.get(postId) || [] },
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
