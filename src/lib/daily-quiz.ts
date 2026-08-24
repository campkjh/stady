import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 데일리 퀴즈: 매일(KST 기준) OX 문항 1개를 결정적으로 선택해 모두에게 동일하게 노출.
// 1일 1회 응답, 정답 시 활동 경험치(티어) 반영, 정답률 통계 제공.

export interface DailyQuestion {
  id: string;
  question: string;
  answer: boolean; // 정답(O=true). 응답 전에는 클라이언트로 내보내지 않음.
  categoryName: string;
  setTitle: string;
}

export interface DailyStats {
  total: number;
  correct: number;
  correctRate: number; // 0~100 정수
}

let dailyTableReady = false;

// DailyQuizAnswer 테이블을 멱등 생성. (커뮤니티와 동일하게 마이그레이션 없이 raw SQL로 관리)
export async function ensureDailyQuizTable(): Promise<void> {
  if (dailyTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyQuizAnswer" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "quiz_date" TEXT NOT NULL,
      "question_id" TEXT NOT NULL,
      "selected" BOOLEAN NOT NULL,
      "is_correct" BOOLEAN NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "DailyQuizAnswer_user_date_uq" ON "DailyQuizAnswer" ("user_id", "quiz_date")`
  );
  dailyTableReady = true;
}

// KST(UTC+9) 기준 오늘 날짜 문자열과 일 시드.
export function kstToday(): { dateStr: string; daySeed: number } {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const daySeed = Math.floor(Date.UTC(y, m, d) / 86400000);
  return { dateStr, daySeed };
}

// ── 데일리 퀴즈 과목 설정 ────────────────────────────────────────────────
// 예전엔 전체 문항에서 하나를 뽑아 그날그날 과목이 달라졌다("사문이랑 생윤이 랜덤하게 나온다").
// 사용자가 고른 과목에서만 나오게 한다. 고르지 않았으면 전과 똑같이 전체에서 뽑는다.
let dailyPrefTableReady = false;
export async function ensureDailyQuizPrefTable(): Promise<void> {
  if (dailyPrefTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyQuizPref" (
      "user_id" TEXT PRIMARY KEY,
      "category_ids" TEXT NOT NULL,
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  dailyPrefTableReady = true;
}

/** 사용자가 고른 과목 id 목록. 설정한 적이 없으면 빈 배열(=전체). */
export async function getDailyCategoryPref(userId: string): Promise<string[]> {
  await ensureDailyQuizPrefTable();
  const rows = await prisma.$queryRawUnsafe<{ category_ids: string }[]>(
    `SELECT "category_ids" FROM "DailyQuizPref" WHERE "user_id" = $1 LIMIT 1`,
    userId
  );
  const raw = rows[0]?.category_ids;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 과목 설정 저장. 빈 배열이면 '전체'로 되돌린다. */
export async function setDailyCategoryPref(userId: string, categoryIds: string[]): Promise<void> {
  await ensureDailyQuizPrefTable();
  const clean = [...new Set(categoryIds.filter((x) => typeof x === "string" && x.length > 0))].slice(0, 20);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DailyQuizPref" ("user_id", "category_ids", "updated_at")
     VALUES ($1, $2, now())
     ON CONFLICT ("user_id") DO UPDATE SET "category_ids" = EXCLUDED."category_ids", "updated_at" = now()`,
    userId,
    JSON.stringify(clean)
  );
}

/** 데일리 퀴즈에 쓸 수 있는 과목(= OX 문항이 실제로 있는 과목)과 문항 수. */
export async function getDailyCategoryOptions(): Promise<{ id: string; name: string; count: number }[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string; c: bigint }[]>(
    `SELECT c."id", c."name", COUNT(q."id")::bigint AS c
     FROM "OxQuestion" q
     JOIN "OxQuizSet" s ON s."id" = q."oxQuizSetId"
     JOIN "Category" c ON c."id" = s."categoryId"
     GROUP BY c."id", c."name"
     HAVING COUNT(q."id") > 0
     ORDER BY COUNT(q."id") DESC`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.c) }));
}

// 오늘의 데일리 문항(KST 일 시드로 결정적 선택).
export async function getTodaysDailyQuestion(categoryIds: string[] = []): Promise<DailyQuestion | null> {
  const { daySeed } = kstToday();
  // 고른 과목이 있으면 그 안에서만 뽑는다. 없으면 전체(기존 동작).
  const filter = categoryIds.length > 0 ? `WHERE s."categoryId" = ANY($1::text[])` : "";
  const params = categoryIds.length > 0 ? [categoryIds] : [];
  const countRows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c
     FROM "OxQuestion" q
     JOIN "OxQuizSet" s ON s."id" = q."oxQuizSetId"
     ${filter}`,
    ...params
  );
  const total = Number(countRows[0]?.c ?? 0);
  // 고른 과목에 문항이 없으면(과목이 비었거나 삭제됨) 전체로 되돌아간다 — 카드가 비지 않게.
  if (total === 0) return categoryIds.length > 0 ? getTodaysDailyQuestion([]) : null;
  const offset = ((daySeed % total) + total) % total;
  const rows = await prisma.$queryRawUnsafe<
    { id: string; question: string; answer: boolean; category_name: string; set_title: string }[]
  >(
    `SELECT q."id", q."question", q."answer", c."name" AS category_name, s."title" AS set_title
     FROM "OxQuestion" q
     JOIN "OxQuizSet" s ON s."id" = q."oxQuizSetId"
     JOIN "Category" c ON c."id" = s."categoryId"
     ${filter}
     ORDER BY q."id"
     OFFSET ${offset} LIMIT 1`,
    ...params
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    categoryName: r.category_name,
    setTitle: r.set_title,
  };
}

// 특정 사용자의 오늘 응답(있으면).
export async function getMyDailyAnswer(
  userId: string,
  dateStr: string
): Promise<{ selected: boolean; isCorrect: boolean } | null> {
  await ensureDailyQuizTable();
  const rows = await prisma.$queryRawUnsafe<{ selected: boolean; is_correct: boolean }[]>(
    `SELECT "selected", "is_correct" FROM "DailyQuizAnswer" WHERE "user_id" = $1 AND "quiz_date" = $2 LIMIT 1`,
    userId,
    dateStr
  );
  const r = rows[0];
  return r ? { selected: r.selected, isCorrect: r.is_correct } : null;
}

// 오늘 문항의 정답률 통계.
export async function getDailyStats(dateStr: string, questionId: string): Promise<DailyStats> {
  await ensureDailyQuizTable();
  const rows = await prisma.$queryRawUnsafe<{ total: bigint; correct: bigint }[]>(
    `SELECT COUNT(*)::bigint AS total,
            COALESCE(SUM(CASE WHEN "is_correct" THEN 1 ELSE 0 END), 0)::bigint AS correct
     FROM "DailyQuizAnswer" WHERE "quiz_date" = $1 AND "question_id" = $2`,
    dateStr,
    questionId
  );
  const total = Number(rows[0]?.total ?? 0);
  const correct = Number(rows[0]?.correct ?? 0);
  const correctRate = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { total, correct, correctRate };
}

// 응답 기록(1일 1회). 이미 있으면 무시(멱등). 실제로 새로 기록됐으면 true 반환
// (동시 이중 제출 시 경험치 중복 표시 방지에 사용).
export async function recordDailyAnswer(
  userId: string,
  dateStr: string,
  questionId: string,
  selected: boolean,
  isCorrect: boolean
): Promise<boolean> {
  await ensureDailyQuizTable();
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO "DailyQuizAnswer" ("id", "user_id", "quiz_date", "question_id", "selected", "is_correct")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ("user_id", "quiz_date") DO NOTHING`,
    randomUUID(),
    userId,
    dateStr,
    questionId,
    selected,
    isCorrect
  );
  return Number(inserted) > 0;
}
