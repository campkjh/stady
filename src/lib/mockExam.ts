import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 모의고사: 관리자가 시험지 이미지를 업로드하고, 사용자는 태블릿에서 그 이미지 위에
// 펜/형광펜/OCR 등으로 필기하며 푼다. 커뮤니티/공지와 동일하게 raw SQL로 관리.

export interface MockExamItem {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrls: string[];
  createdAt: Date;
}

let ready = false;

export async function ensureMockExamTables(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MockExam" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "subtitle" TEXT,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MockExamImage" (
      "id" TEXT PRIMARY KEY,
      "exam_id" TEXT NOT NULL,
      "image_url" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MockExamImage_exam_idx" ON "MockExamImage" ("exam_id")`
  );
  ready = true;
}

async function replaceImages(examId: string, urls: string[]): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExamImage" WHERE "exam_id" = $1`, examId);
  for (let i = 0; i < urls.length; i++) {
    const url = String(urls[i] || "").trim();
    if (!url) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "MockExamImage" ("id", "exam_id", "image_url", "sort_order") VALUES ($1, $2, $3, $4)`,
      randomUUID(),
      examId,
      url,
      i
    );
  }
}

interface ExamRow {
  id: string;
  title: string;
  subtitle: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

async function attachImages(exams: MockExamItem[]): Promise<void> {
  if (exams.length === 0) return;
  const ids = exams.map((e) => e.id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(", ");
  const imgs = await prisma.$queryRawUnsafe<{ exam_id: string; image_url: string }[]>(
    `SELECT "exam_id", "image_url" FROM "MockExamImage" WHERE "exam_id" IN (${ph}) ORDER BY "sort_order" ASC`,
    ...ids
  );
  const byExam: Record<string, string[]> = {};
  for (const im of imgs) (byExam[im.exam_id] ??= []).push(im.image_url);
  for (const e of exams) e.imageUrls = byExam[e.id] ?? [];
}

function mapExam(r: ExamRow): MockExamItem {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    imageUrls: [],
    createdAt: r.created_at,
  };
}

export async function listMockExams(activeOnly = false): Promise<MockExamItem[]> {
  await ensureMockExamTables();
  const rows = activeOnly
    ? await prisma.$queryRawUnsafe<ExamRow[]>(
        `SELECT * FROM "MockExam" WHERE "is_active" = true ORDER BY "sort_order" ASC, "created_at" DESC`
      )
    : await prisma.$queryRawUnsafe<ExamRow[]>(
        `SELECT * FROM "MockExam" ORDER BY "sort_order" ASC, "created_at" DESC`
      );
  const exams = rows.map(mapExam);
  await attachImages(exams);
  return exams;
}

export async function getMockExam(id: string): Promise<MockExamItem | null> {
  await ensureMockExamTables();
  const rows = await prisma.$queryRawUnsafe<ExamRow[]>(
    `SELECT * FROM "MockExam" WHERE "id" = $1 LIMIT 1`,
    id
  );
  if (rows.length === 0) return null;
  const exam = mapExam(rows[0]);
  await attachImages([exam]);
  return exam;
}

export async function createMockExam(input: {
  title: string;
  subtitle?: string | null;
  imageUrls?: string[];
  sortOrder?: number;
  isActive?: boolean;
}): Promise<void> {
  await ensureMockExamTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MockExam" ("id","title","subtitle","sort_order","is_active") VALUES ($1,$2,$3,$4,$5)`,
    id,
    input.title,
    input.subtitle ?? null,
    input.sortOrder ?? 0,
    input.isActive ?? true
  );
  if (input.imageUrls && input.imageUrls.length > 0) {
    await replaceImages(id, input.imageUrls);
  }
}

export async function updateMockExam(
  id: string,
  fields: { title?: string; subtitle?: string | null; sortOrder?: number; isActive?: boolean; imageUrls?: string[] }
): Promise<void> {
  await ensureMockExamTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.title !== undefined) { sets.push(`"title" = $${i++}`); vals.push(fields.title); }
  if (fields.subtitle !== undefined) { sets.push(`"subtitle" = $${i++}`); vals.push(fields.subtitle); }
  if (fields.sortOrder !== undefined) { sets.push(`"sort_order" = $${i++}`); vals.push(fields.sortOrder); }
  if (fields.isActive !== undefined) { sets.push(`"is_active" = $${i++}`); vals.push(fields.isActive); }
  if (sets.length > 0) {
    vals.push(id);
    await prisma.$executeRawUnsafe(`UPDATE "MockExam" SET ${sets.join(", ")} WHERE "id" = $${i}`, ...vals);
  }
  if (fields.imageUrls !== undefined) {
    await replaceImages(id, fields.imageUrls);
  }
}

export async function deleteMockExam(id: string): Promise<void> {
  await ensureMockExamTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExamImage" WHERE "exam_id" = $1`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExam" WHERE "id" = $1`, id);
}
