import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 모의고사: 관리자가 시험지 이미지를 업로드하고, 사용자는 태블릿에서 그 이미지 위에
// 펜/형광펜/OCR 등으로 필기하며 푼다. 커뮤니티/공지와 동일하게 raw SQL로 관리.

// 페이지별 텍스트 줄 박스. 각 줄은 [x, y, w, h](페이지 크기 대비 0~1 정규화).
// 형광펜이 글자 줄에 맞춰 일직선으로 그려지도록 스냅하는 데 쓴다.
export type LineBox = [number, number, number, number];

export interface MockExamItem {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrls: string[];
  // imageUrls와 인덱스가 1:1로 대응. 줄 데이터가 없는 페이지는 빈 배열.
  lineBoxes: LineBox[][];
  // 해설 페이지(별도 탭 "해설보기"). 없으면 빈 배열.
  solutionImageUrls: string[];
  solutionLineBoxes: LineBox[][];
  // 분류(시행 연도 / 시행 월 / 과목 id). 미분류면 null.
  year: number | null;
  month: number | null;
  subject: string | null;
  createdAt: Date;
}

type Section = "problem" | "solution";

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
  // 형광펜 스냅용 텍스트 줄 박스(JSON). 벡터 PDF에서 추출한 페이지만 채워진다.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamImage" ADD COLUMN IF NOT EXISTS "text_lines" TEXT`
  );
  // 문제/해설 구분('problem'|'solution'). MockExamImage는 명시 컬럼으로만 조회하므로
  // ALTER 안전(MockExam만 SELECT * — 그건 건드리지 않음). 기존 행은 'problem'.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamImage" ADD COLUMN IF NOT EXISTS "section" TEXT NOT NULL DEFAULT 'problem'`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MockExamImage_exam_idx" ON "MockExamImage" ("exam_id")`
  );
  // 분류(시행 연도/월/과목)는 별도 테이블. MockExam은 SELECT *로 조회하므로 컬럼을
  // 추가하면 Neon 캐시 플랜이 깨진다("cached plan must not change result type").
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MockExamMeta" (
      "exam_id" TEXT PRIMARY KEY,
      "year" INTEGER,
      "month" INTEGER,
      "subject" TEXT
    )
  `);
  ready = true;
}

// 분류 저장(있으면 갱신). 값이 null이면 '미분류'로 비운다.
async function saveMeta(
  examId: string,
  meta: { year?: number | null; month?: number | null; subject?: string | null }
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MockExamMeta" ("exam_id","year","month","subject") VALUES ($1,$2,$3,$4)
     ON CONFLICT ("exam_id") DO UPDATE SET "year" = EXCLUDED."year", "month" = EXCLUDED."month", "subject" = EXCLUDED."subject"`,
    examId,
    meta.year ?? null,
    meta.month ?? null,
    meta.subject ?? null
  );
}

async function attachMeta(exams: MockExamItem[]): Promise<void> {
  if (exams.length === 0) return;
  const ids = exams.map((e) => e.id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<{ exam_id: string; year: number | null; month: number | null; subject: string | null }[]>(
    `SELECT "exam_id", "year", "month", "subject" FROM "MockExamMeta" WHERE "exam_id" IN (${ph})`,
    ...ids
  );
  const byId = new Map(rows.map((r) => [r.exam_id, r]));
  for (const e of exams) {
    const m = byId.get(e.id);
    e.year = m?.year ?? null;
    e.month = m?.month ?? null;
    e.subject = m?.subject ?? null;
  }
}

async function replaceImages(examId: string, urls: string[], section: Section = "problem"): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MockExamImage" WHERE "exam_id" = $1 AND "section" = $2`,
    examId,
    section
  );
  for (let i = 0; i < urls.length; i++) {
    const url = String(urls[i] || "").trim();
    if (!url) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "MockExamImage" ("id", "exam_id", "image_url", "sort_order", "section") VALUES ($1, $2, $3, $4, $5)`,
      randomUUID(),
      examId,
      url,
      i,
      section
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

function parseLineBoxes(raw: string | null): LineBox[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LineBox[]) : [];
  } catch {
    return [];
  }
}

async function attachImages(exams: MockExamItem[]): Promise<void> {
  if (exams.length === 0) return;
  const ids = exams.map((e) => e.id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(", ");
  const imgs = await prisma.$queryRawUnsafe<{ exam_id: string; image_url: string; text_lines: string | null; section: string }[]>(
    `SELECT "exam_id", "image_url", "text_lines", "section" FROM "MockExamImage" WHERE "exam_id" IN (${ph}) ORDER BY "sort_order" ASC`,
    ...ids
  );
  const probUrl: Record<string, string[]> = {};
  const probLines: Record<string, LineBox[][]> = {};
  const solUrl: Record<string, string[]> = {};
  const solLines: Record<string, LineBox[][]> = {};
  for (const im of imgs) {
    const isSol = im.section === "solution";
    (isSol ? (solUrl[im.exam_id] ??= []) : (probUrl[im.exam_id] ??= [])).push(im.image_url);
    (isSol ? (solLines[im.exam_id] ??= []) : (probLines[im.exam_id] ??= [])).push(parseLineBoxes(im.text_lines));
  }
  for (const e of exams) {
    e.imageUrls = probUrl[e.id] ?? [];
    e.lineBoxes = probLines[e.id] ?? [];
    e.solutionImageUrls = solUrl[e.id] ?? [];
    e.solutionLineBoxes = solLines[e.id] ?? [];
  }
}

function mapExam(r: ExamRow): MockExamItem {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    imageUrls: [],
    lineBoxes: [],
    solutionImageUrls: [],
    solutionLineBoxes: [],
    year: null,
    month: null,
    subject: null,
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
  await Promise.all([attachImages(exams), attachMeta(exams)]);
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
  await Promise.all([attachImages([exam]), attachMeta([exam])]);
  return exam;
}

export async function createMockExam(input: {
  title: string;
  subtitle?: string | null;
  imageUrls?: string[];
  solutionImageUrls?: string[];
  sortOrder?: number;
  isActive?: boolean;
  year?: number | null;
  month?: number | null;
  subject?: string | null;
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
    await replaceImages(id, input.imageUrls, "problem");
  }
  if (input.solutionImageUrls && input.solutionImageUrls.length > 0) {
    await replaceImages(id, input.solutionImageUrls, "solution");
  }
  await saveMeta(id, { year: input.year ?? null, month: input.month ?? null, subject: input.subject ?? null });
}

export async function updateMockExam(
  id: string,
  fields: {
    title?: string;
    subtitle?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    imageUrls?: string[];
    solutionImageUrls?: string[];
    year?: number | null;
    month?: number | null;
    subject?: string | null;
  }
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
    await replaceImages(id, fields.imageUrls, "problem");
  }
  if (fields.solutionImageUrls !== undefined) {
    await replaceImages(id, fields.solutionImageUrls, "solution");
  }
  if (fields.year !== undefined || fields.month !== undefined || fields.subject !== undefined) {
    await saveMeta(id, { year: fields.year ?? null, month: fields.month ?? null, subject: fields.subject ?? null });
  }
}

export async function deleteMockExam(id: string): Promise<void> {
  await ensureMockExamTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExamImage" WHERE "exam_id" = $1`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExamMeta" WHERE "exam_id" = $1`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM "MockExam" WHERE "id" = $1`, id);
}
