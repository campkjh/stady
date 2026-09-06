import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 커뮤니티 상단 "스타디 사용 후기" 하이라이트 (인스타 스토리형).
// 하이라이트 1개 = 원형 커버 + 그 안에 넘겨보는 이미지 여러 장.
// raw SQL + CREATE TABLE IF NOT EXISTS — 스키마에 없는 테이블을 쓰는 다른 모듈과 같은 패턴.

export interface StorySlide {
  id: string;
  imageUrl: string;
  sortOrder: number;
}
export interface StoryHighlight {
  id: string;
  title: string;
  coverUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  slides: StorySlide[];
}

let ready = false;
async function ensure() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoryHighlight" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "cover_url" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoryHighlightSlide" (
      "id" TEXT PRIMARY KEY,
      "highlight_id" TEXT NOT NULL REFERENCES "StoryHighlight"("id") ON DELETE CASCADE,
      "image_url" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StoryHighlightSlide_highlight_idx" ON "StoryHighlightSlide" ("highlight_id", "sort_order")`
  );
  ready = true;
}

interface HRow {
  id: string; title: string; cover_url: string; sort_order: number; is_active: boolean; created_at: Date;
}

/** 하이라이트 목록. activeOnly=true 면 노출 중인 것만(사용자 화면). */
export async function listHighlights(activeOnly = false): Promise<StoryHighlight[]> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<HRow[]>(
    activeOnly
      ? `SELECT * FROM "StoryHighlight" WHERE "is_active" = true ORDER BY "sort_order" ASC, "created_at" DESC`
      : `SELECT * FROM "StoryHighlight" ORDER BY "sort_order" ASC, "created_at" DESC`
  );
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(", ");
  const slides = await prisma.$queryRawUnsafe<{ id: string; highlight_id: string; image_url: string; sort_order: number }[]>(
    `SELECT * FROM "StoryHighlightSlide" WHERE "highlight_id" IN (${ph}) ORDER BY "sort_order" ASC`,
    ...ids
  );
  const byId: Record<string, StorySlide[]> = {};
  for (const s of slides) {
    (byId[s.highlight_id] ??= []).push({ id: s.id, imageUrl: s.image_url, sortOrder: s.sort_order });
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    coverUrl: r.cover_url,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: new Date(r.created_at).toISOString(),
    slides: byId[r.id] ?? [],
  }));
}

async function replaceSlides(highlightId: string, imageUrls: string[]) {
  await prisma.$executeRawUnsafe(`DELETE FROM "StoryHighlightSlide" WHERE "highlight_id" = $1`, highlightId);
  for (let i = 0; i < imageUrls.length; i++) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StoryHighlightSlide" ("id","highlight_id","image_url","sort_order") VALUES ($1,$2,$3,$4)`,
      randomUUID(), highlightId, imageUrls[i], i
    );
  }
}

export async function createHighlight(input: {
  title: string; coverUrl: string; imageUrls: string[]; sortOrder?: number;
}): Promise<string> {
  await ensure();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StoryHighlight" ("id","title","cover_url","sort_order") VALUES ($1,$2,$3,$4)`,
    id, input.title, input.coverUrl, input.sortOrder ?? 0
  );
  await replaceSlides(id, input.imageUrls);
  return id;
}

export async function updateHighlight(id: string, fields: {
  title?: string; coverUrl?: string; imageUrls?: string[]; sortOrder?: number; isActive?: boolean;
}) {
  await ensure();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, v: unknown) => { vals.push(v); sets.push(`"${col}" = $${vals.length}`); };
  if (fields.title !== undefined) push("title", fields.title);
  if (fields.coverUrl !== undefined) push("cover_url", fields.coverUrl);
  if (fields.sortOrder !== undefined) push("sort_order", fields.sortOrder);
  if (fields.isActive !== undefined) push("is_active", fields.isActive);
  if (sets.length > 0) {
    vals.push(id);
    await prisma.$executeRawUnsafe(`UPDATE "StoryHighlight" SET ${sets.join(", ")} WHERE "id" = $${vals.length}`, ...vals);
  }
  if (fields.imageUrls !== undefined) await replaceSlides(id, fields.imageUrls);
}

export async function deleteHighlight(id: string) {
  await ensure();
  await prisma.$executeRawUnsafe(`DELETE FROM "StoryHighlight" WHERE "id" = $1`, id);
}
