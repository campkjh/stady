import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 모의고사 문항 단위 풀이(모바일). 시험지 페이지를 문항별로 잘라 한 문항씩 보여주고
// ①~⑤(수학 단답형은 숫자)를 고르게 한 뒤 채점한다.
//
// MockExam/MockExamImage 는 그대로 두고 사이드카 테이블로 붙인다.
// (MockExam 은 SELECT * 로 읽어서 컬럼을 추가하면 Neon 캐시 플랜이 깨진다.)

export interface MockExamQuestion {
  number: number;
  imageUrl: string;
  /** 객관식이면 1~5. 수학 단답형은 실제 답(예: 213). 0 = 전항 정답(정답 정정된 문항). */
  answer: number;
  /** 5 = 오지선다, 0 = 단답형(숫자 입력) */
  choiceCount: number;
  /**
   * 여러 문항이 공유하는 지문 이미지("[1~3] 다음 글을 읽고 …").
   * 국어처럼 지문이 따로 있는 과목은 이게 없으면 문제를 풀 수 없다.
   * 단이나 페이지를 넘어가는 지문은 여러 장으로 쪼개진다.
   */
  passageUrls: string[];
  /** 발문 첫 문장 텍스트("1. 윗글의 내용과 일치하지 않는 것은?"). 헤더 제목으로 쓴다. */
  title: string | null;
  /** 발문만 잘라낸 이미지(선택지 제외). 선택지를 따로 탭해 고르는 문항에만 있다. */
  stemUrl: string | null;
  /**
   * 선택지 ①~⑤ 를 각각 잘라낸 이미지 5장. 있으면 앱은 이 이미지를 탭해 고르는 UI 를 쓴다.
   * "① ㄱ,ㄴ ② ㄱ,ㄷ…" 처럼 다섯 개가 한 줄에 몰린 문항은 쪼갤 수 없어 null —
   * 그 경우 통짜 이미지 + ①~⑤ 버튼으로 동작한다.
   */
  choiceUrls: string[] | null;
}

/** 채점 결과에 담아 보내는 문항 정보(정답 포함 — 제출 후에만 내려간다). */
export interface GradedQuestion extends MockExamQuestion {
  selected: number | null;
  isCorrect: boolean;
}

let ready = false;

export async function ensureMockExamQuestionTables(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MockExamQuestion" (
      "id" TEXT PRIMARY KEY,
      "exam_id" TEXT NOT NULL,
      "number" INTEGER NOT NULL,
      "image_url" TEXT NOT NULL,
      "answer" INTEGER NOT NULL,
      "choice_count" INTEGER NOT NULL DEFAULT 5,
      "created_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  // 공유 지문/발문/선택지 이미지(JSON 배열·단일 URL 문자열). MockExamQuestion 은 명시
  // 컬럼으로만 조회하므로 ALTER 가 안전하다(SELECT * 로 읽는 테이블이 아니다).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "passage_urls" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "stem_url" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "choice_urls" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MockExamQuestion" ADD COLUMN IF NOT EXISTS "title" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "MockExamQuestion_exam_num_key" ON "MockExamQuestion" ("exam_id", "number")`
  );
  // 사용자 답안. 문항당 1행만 두고 다시 고르면 갱신한다(마지막 선택이 곧 현재 답안).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MockExamAnswer" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "exam_id" TEXT NOT NULL,
      "number" INTEGER NOT NULL,
      "selected" INTEGER NOT NULL,
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "MockExamAnswer_user_exam_num_key" ON "MockExamAnswer" ("user_id", "exam_id", "number")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MockExamAnswer_user_exam_idx" ON "MockExamAnswer" ("user_id", "exam_id")`
  );
  ready = true;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 문항 목록. 정답은 포함하지 않는다(풀기 전에 내려가면 안 된다). */
export async function listQuestions(examId: string): Promise<Omit<MockExamQuestion, "answer">[]> {
  await ensureMockExamQuestionTables();
  const rows = await prisma.$queryRawUnsafe<
    { number: number; image_url: string; choice_count: number; title: string | null; passage_urls: string | null; stem_url: string | null; choice_urls: string | null }[]
  >(
    `SELECT "number", "image_url", "choice_count", "title", "passage_urls", "stem_url", "choice_urls"
     FROM "MockExamQuestion" WHERE "exam_id" = $1 ORDER BY "number" ASC`,
    examId
  );
  return rows.map((r) => {
    const choices = parseJsonArray(r.choice_urls);
    return {
      number: r.number,
      imageUrl: r.image_url,
      choiceCount: r.choice_count,
      title: r.title,
      passageUrls: parseJsonArray(r.passage_urls),
      stemUrl: r.stem_url,
      // 5장이 온전히 있을 때만 탭 UI 를 쓴다(일부만 있으면 통짜로 폴백).
      choiceUrls: choices.length === 5 && r.stem_url ? choices : null,
    };
  });
}

export async function hasQuestions(examId: string): Promise<boolean> {
  await ensureMockExamQuestionTables();
  const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM "MockExamQuestion" WHERE "exam_id" = $1`,
    examId
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

/** 목록/홈에서 "문제 풀기"를 붙일 시험지를 한 번에 판별한다(카드마다 조회하면 N+1). */
export async function examIdsWithQuestions(examIds: string[]): Promise<Set<string>> {
  if (examIds.length === 0) return new Set();
  await ensureMockExamQuestionTables();
  const rows = await prisma.$queryRawUnsafe<{ exam_id: string }[]>(
    `SELECT DISTINCT "exam_id" FROM "MockExamQuestion" WHERE "exam_id" = ANY($1::text[])`,
    examIds
  );
  return new Set(rows.map((r) => r.exam_id));
}

/** 내가 고른 답(이어풀기용). { 문항번호: 선택값 } */
export async function getMyAnswers(userId: string, examId: string): Promise<Record<number, number>> {
  await ensureMockExamQuestionTables();
  const rows = await prisma.$queryRawUnsafe<{ number: number; selected: number }[]>(
    `SELECT "number", "selected" FROM "MockExamAnswer" WHERE "user_id" = $1 AND "exam_id" = $2`,
    userId,
    examId
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[r.number] = r.selected;
  return out;
}

/** 답 하나 저장(고를 때마다). 다시 고르면 덮어쓴다. */
export async function saveAnswer(userId: string, examId: string, number: number, selected: number): Promise<void> {
  await ensureMockExamQuestionTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MockExamAnswer" ("id","user_id","exam_id","number","selected","updated_at")
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT ("user_id","exam_id","number")
     DO UPDATE SET "selected" = EXCLUDED."selected", "updated_at" = now()`,
    randomUUID(),
    userId,
    examId,
    number,
    selected
  );
}

/** 채점. 정답은 이 시점에만 내려간다. */
export async function grade(userId: string, examId: string): Promise<{
  total: number;
  correct: number;
  answered: number;
  questions: GradedQuestion[];
}> {
  await ensureMockExamQuestionTables();
  const rows = await prisma.$queryRawUnsafe<
    { number: number; image_url: string; answer: number; choice_count: number; title: string | null; passage_urls: string | null; stem_url: string | null; choice_urls: string | null; selected: number | null }[]
  >(
    `SELECT q."number", q."image_url", q."answer", q."choice_count", q."title", q."passage_urls", q."stem_url", q."choice_urls", a."selected"
     FROM "MockExamQuestion" q
     LEFT JOIN "MockExamAnswer" a
       ON a."exam_id" = q."exam_id" AND a."number" = q."number" AND a."user_id" = $2
     WHERE q."exam_id" = $1
     ORDER BY q."number" ASC`,
    examId,
    userId
  );
  const questions: GradedQuestion[] = rows.map((r) => {
    const choices = parseJsonArray(r.choice_urls);
    return {
      number: r.number,
      imageUrl: r.image_url,
      answer: r.answer,
      choiceCount: r.choice_count,
      title: r.title,
      passageUrls: parseJsonArray(r.passage_urls),
      stemUrl: r.stem_url,
      choiceUrls: choices.length === 5 && r.stem_url ? choices : null,
      selected: r.selected,
      // answer 0 = 전항 정답 → 아무거나 고르기만 하면 정답.
      isCorrect: r.selected != null && (r.answer === 0 || r.selected === r.answer),
    };
  });
  return {
    total: questions.length,
    correct: questions.filter((q) => q.isCorrect).length,
    answered: questions.filter((q) => q.selected != null).length,
    questions,
  };
}

/** 답안 초기화(다시 풀기). */
export async function resetAnswers(userId: string, examId: string): Promise<void> {
  await ensureMockExamQuestionTables();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MockExamAnswer" WHERE "user_id" = $1 AND "exam_id" = $2`,
    userId,
    examId
  );
}
