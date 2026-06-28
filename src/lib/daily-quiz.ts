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

// 오늘의 데일리 문항(KST 일 시드로 결정적 선택).
export async function getTodaysDailyQuestion(): Promise<DailyQuestion | null> {
  const { daySeed } = kstToday();
  const countRows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "OxQuestion"`
  );
  const total = Number(countRows[0]?.c ?? 0);
  if (total === 0) return null;
  const offset = ((daySeed % total) + total) % total;
  const rows = await prisma.$queryRawUnsafe<
    { id: string; question: string; answer: boolean; category_name: string; set_title: string }[]
  >(
    `SELECT q."id", q."question", q."answer", c."name" AS category_name, s."title" AS set_title
     FROM "OxQuestion" q
     JOIN "OxQuizSet" s ON s."id" = q."oxQuizSetId"
     JOIN "Category" c ON c."id" = s."categoryId"
     ORDER BY q."id"
     OFFSET ${offset} LIMIT 1`
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
