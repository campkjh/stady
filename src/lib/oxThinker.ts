import { prisma } from "@/lib/prisma";

// 사상가 퀴즈 — 제시문을 읽고 그 주장을 한 사상가(학파)를 고르는 객관식.
// 기존 OX 세트의 "마지막 파트"로 붙는다. OxQuestion 은 O/X(boolean) 전용이라
// 컬럼을 늘리는 대신 별도 테이블로 둔다(SELECT * 쓰는 테이블을 ALTER 하면
// Neon 풀러의 캐시된 플랜과 충돌해 500 이 난다 — 이 저장소의 기존 규칙).

export interface ThinkerQuestion {
  id: string;
  order: number;
  passage: string;
  choices: string[];
  answer: string;
  explanation: string | null;
}

let ready = false;

export async function ensureThinkerTables(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OxThinkerQuestion" (
      "id" TEXT PRIMARY KEY,
      "ox_quiz_set_id" TEXT NOT NULL REFERENCES "OxQuizSet"("id") ON DELETE CASCADE,
      "order" INTEGER NOT NULL DEFAULT 0,
      "passage" TEXT NOT NULL,
      "choices" TEXT NOT NULL,
      "answer" TEXT NOT NULL,
      "explanation" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OxThinkerQuestion_set_idx"
    ON "OxThinkerQuestion" ("ox_quiz_set_id", "order")
  `);
  // 응답 기록 — OxAnswer 는 questionId 가 OxQuestion 을 가리키는 FK 라 쓸 수 없다.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OxThinkerAnswer" (
      "id" TEXT PRIMARY KEY,
      "attempt_id" TEXT NOT NULL REFERENCES "QuizAttempt"("id") ON DELETE CASCADE,
      "question_id" TEXT NOT NULL REFERENCES "OxThinkerQuestion"("id") ON DELETE CASCADE,
      "selected" TEXT,
      "is_correct" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OxThinkerAnswer_question_idx"
    ON "OxThinkerAnswer" ("question_id")
  `);
  ready = true;
}

interface Row {
  id: string;
  order: number;
  passage: string;
  choices: string;
  answer: string;
  explanation: string | null;
}

/** 세트에 붙은 사상가 문제(순서대로). 없으면 빈 배열. */
export async function getThinkerQuestions(setId: string): Promise<ThinkerQuestion[]> {
  try {
    await ensureThinkerTables();
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "id", "order", "passage", "choices", "answer", "explanation"
       FROM "OxThinkerQuestion" WHERE "ox_quiz_set_id" = $1 ORDER BY "order" ASC`,
      setId
    );
    return rows.map((r) => ({
      id: r.id,
      order: r.order,
      passage: r.passage,
      choices: safeChoices(r.choices),
      answer: r.answer,
      explanation: r.explanation,
    }));
  } catch (error) {
    console.error("getThinkerQuestions failed:", error);
    return [];
  }
}

/** 채점용 — 문제 id → 정답 보기. */
export async function getThinkerAnswerMap(setId: string): Promise<Map<string, string>> {
  const rows = await getThinkerQuestions(setId);
  return new Map(rows.map((r) => [r.id, r.answer]));
}

function safeChoices(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((c) => String(c)) : [];
  } catch {
    return [];
  }
}
