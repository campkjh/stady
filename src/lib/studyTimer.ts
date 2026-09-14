import { randomUUID, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { grantFreePremiumDays } from "@/lib/premiumGrant";

// 타이머 확장 — ① 공부 중 랜덤 OX 확인 퀴즈(무응답 3시간이면 타이머 자동 종료)
//                ② 주간 랭킹  ③ 주간 1~3위 프라임 1주 자동 지급
//
// StudySession 은 Prisma 모델이라 컬럼을 늘리지 않는다(마이그레이션 필요).
// 확인 퀴즈는 별도 raw SQL 테이블에 둔다(community·iap 와 같은 ensure 패턴).

/** 확인 퀴즈를 안 풀고 버티면 타이머가 꺼지기까지의 시간. */
export const CHECK_GRACE_MS = 3 * 60 * 60 * 1000;
/** 다음 확인 퀴즈까지 걸리는 시간(분) 범위 — 세션마다 다르게(랜덤). */
const CHECK_MIN_GAP_MIN = 15;
const CHECK_MAX_GAP_MIN = 60;

let ready = false;
async function ensure() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimerCheck" (
      "id" TEXT PRIMARY KEY,
      "session_id" TEXT NOT NULL REFERENCES "StudySession"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL,
      "question_id" TEXT NOT NULL,
      "issued_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "due_at" TIMESTAMP(3) NOT NULL,
      "answered_at" TIMESTAMP(3),
      "is_correct" BOOLEAN
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TimerCheck_session_idx" ON "TimerCheck" ("session_id", "issued_at" DESC)`
  );
  // 만료 세션 청소용.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TimerCheck_due_idx" ON "TimerCheck" ("answered_at", "due_at")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WeeklyStudyAward" (
      "week_start" DATE NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "rank" INTEGER NOT NULL,
      "seconds" INTEGER NOT NULL,
      "days" INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      PRIMARY KEY ("week_start", "user_id")
    )
  `);
  ready = true;
}

/**
 * 무응답으로 기한이 지난 확인 퀴즈가 있는 세션을 자동 종료한다(전체 대상).
 * 종료 시각은 기한(발급 +3시간) — 그 뒤 시간은 자리에 있었다는 근거가 없다.
 * 기존 24시간 스테일 정리와 같은 자리(sessions GET)에서 함께 돈다.
 */
export async function closeExpiredCheckSessions(): Promise<number> {
  await ensure();
  return prisma.$executeRawUnsafe(`
    UPDATE "StudySession" s
    SET "endedAt" = c."due_at",
        "totalSeconds" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (c."due_at" - s."startedAt"))))::int
    FROM "TimerCheck" c
    WHERE c."session_id" = s."id"
      AND s."endedAt" IS NULL
      AND c."answered_at" IS NULL
      AND c."due_at" < now()
  `);
}

export interface PendingCheck {
  id: string;
  questionId: string;
  question: string;
  dueAt: string;
  issuedAt: string;
}

// 세션마다 "다음 퀴즈까지 몇 분" 을 다르게 하되, 저장하지 않고 세션 id 로 정한다.
// (StudySession 에 컬럼을 안 늘리려는 것 — 같은 세션·같은 순번이면 항상 같은 값)
function gapMinutes(sessionId: string, seq: number): number {
  const h = createHash("sha1").update(`${sessionId}:${seq}`).digest()[0];
  return CHECK_MIN_GAP_MIN + (h % (CHECK_MAX_GAP_MIN - CHECK_MIN_GAP_MIN + 1));
}

/**
 * 진행 중인 세션에 확인 퀴즈가 필요하면 발급하고, 이미 있으면 그대로 돌려준다.
 * 답할 시간이 지났으면 세션을 끝내고 null(타이머 꺼짐).
 */
export async function getOrIssueCheck(userId: string): Promise<PendingCheck | null> {
  await ensure();
  const sessions = await prisma.$queryRawUnsafe<{ id: string; startedAt: Date }[]>(
    `SELECT "id", "startedAt" FROM "StudySession"
     WHERE "userId" = $1 AND "endedAt" IS NULL ORDER BY "startedAt" DESC LIMIT 1`,
    userId
  );
  const session = sessions[0];
  if (!session) return null;

  const rows = await prisma.$queryRawUnsafe<{
    id: string; question_id: string; issued_at: Date; due_at: Date; answered_at: Date | null; n: bigint;
  }[]>(
    `SELECT c.*, (SELECT COUNT(*) FROM "TimerCheck" x WHERE x."session_id" = $1)::bigint AS n
     FROM "TimerCheck" c WHERE c."session_id" = $1 ORDER BY c."issued_at" DESC LIMIT 1`,
    session.id
  );
  const last = rows[0];
  const now = Date.now();

  if (last && !last.answered_at) {
    if (new Date(last.due_at).getTime() <= now) {
      await closeExpiredCheckSessions();
      return null;
    }
    const q = await prisma.$queryRawUnsafe<{ question: string }[]>(
      `SELECT "question" FROM "OxQuestion" WHERE "id" = $1 LIMIT 1`,
      last.question_id
    );
    return {
      id: last.id,
      questionId: last.question_id,
      question: q[0]?.question ?? "지금 공부 중인가요?",
      dueAt: new Date(last.due_at).toISOString(),
      issuedAt: new Date(last.issued_at).toISOString(),
    };
  }

  const seq = last ? Number(last.n) : 0;
  const anchor = last ? new Date(last.answered_at as Date).getTime() : new Date(session.startedAt).getTime();
  if (now < anchor + gapMinutes(session.id, seq) * 60_000) return null;

  const picked = await prisma.$queryRawUnsafe<{ id: string; question: string }[]>(
    `SELECT "id", "question" FROM "OxQuestion" ORDER BY random() LIMIT 1`
  );
  if (!picked[0]) return null; // 문항이 없으면 아무 것도 하지 않는다(타이머는 계속).

  const id = randomUUID();
  const dueAt = new Date(now + CHECK_GRACE_MS);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TimerCheck" ("id","session_id","user_id","question_id","issued_at","due_at")
     VALUES ($1,$2,$3,$4,now(),$5)`,
    id, session.id, userId, picked[0].id, dueAt
  );
  return {
    id,
    questionId: picked[0].id,
    question: picked[0].question,
    dueAt: dueAt.toISOString(),
    issuedAt: new Date(now).toISOString(),
  };
}

/** 확인 퀴즈 응답. 기한이 지났으면 이미 타이머가 꺼졌다고 알린다. */
export async function answerCheck(
  userId: string,
  checkId: string,
  selected: boolean
): Promise<{ ok: boolean; expired?: boolean; correct?: boolean; answer?: boolean; explanation?: string | null }> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ id: string; question_id: string; due_at: Date; answered_at: Date | null }[]>(
    `SELECT "id","question_id","due_at","answered_at" FROM "TimerCheck" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
    checkId, userId
  );
  const row = rows[0];
  if (!row) return { ok: false };
  if (new Date(row.due_at).getTime() <= Date.now()) {
    await closeExpiredCheckSessions();
    return { ok: false, expired: true };
  }
  const q = await prisma.$queryRawUnsafe<{ answer: boolean; explanation: string | null }[]>(
    `SELECT "answer","explanation" FROM "OxQuestion" WHERE "id" = $1 LIMIT 1`,
    row.question_id
  );
  const correct = q[0] ? q[0].answer === selected : true;
  if (!row.answered_at) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TimerCheck" SET "answered_at" = now(), "is_correct" = $2 WHERE "id" = $1`,
      checkId, correct
    );
  }
  // 맞고 틀리고는 타이머에 영향을 주지 않는다 — 자리에 있는지 확인하는 용도다.
  return { ok: true, correct, answer: q[0]?.answer, explanation: q[0]?.explanation ?? null };
}

/* ───────────────────────── 주간 랭킹 ───────────────────────── */

/** KST 기준 이번 주 월요일 00:00 을 UTC Date 로. offsetWeeks=-1 이면 지난 주. */
export function weekStartKst(offsetWeeks = 0): Date {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = (nowKst.getUTCDay() + 6) % 7; // 월=0
  const midnightKst = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate());
  return new Date(midnightKst - (dow - offsetWeeks * 7) * 86400000 - 9 * 60 * 60 * 1000);
}

export interface WeeklyRankRow {
  userId: string;
  nickname: string;
  avatar: string | null;
  seconds: number;
  /** 누적 공부시간(불꽃 등급 표시용) — 주간 시간과 다르다. */
  totalSeconds: number;
  isMe: boolean;
}

/**
 * 주간 공부시간 순위. 끝난 세션 합 + 지금 진행 중인 세션의 경과를 더한다
 * (오늘 랭킹과 같은 방식 — 안 그러면 공부 중인 사람이 순위에서 빠져 보인다).
 */
export async function getWeeklyRanking(meId: string | null, limit = 50, offsetWeeks = 0): Promise<WeeklyRankRow[]> {
  const start = weekStartKst(offsetWeeks);
  const end = offsetWeeks === 0 ? null : weekStartKst(offsetWeeks + 1);
  const rows = await prisma.$queryRawUnsafe<{ userId: string; nickname: string; avatar: string | null; seconds: bigint; total_seconds: bigint }[]>(
    `SELECT s."userId", u."nickname", u."avatar",
            (SELECT COALESCE(SUM(t."totalSeconds"),0) FROM "StudySession" t
             WHERE t."userId" = s."userId" AND t."endedAt" IS NOT NULL)::bigint AS total_seconds,
            (SUM(CASE WHEN s."endedAt" IS NOT NULL THEN s."totalSeconds" ELSE 0 END)
             + SUM(CASE WHEN s."endedAt" IS NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - s."startedAt")))) ELSE 0 END))::bigint AS seconds
     FROM "StudySession" s JOIN "User" u ON u."id" = s."userId"
     WHERE s."startedAt" >= $1 ${end ? 'AND s."startedAt" < $3' : ""}
     GROUP BY s."userId", u."nickname", u."avatar"
     HAVING (SUM(CASE WHEN s."endedAt" IS NOT NULL THEN s."totalSeconds" ELSE 0 END)
             + SUM(CASE WHEN s."endedAt" IS NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - s."startedAt")))) ELSE 0 END)) > 0
     ORDER BY seconds DESC
     LIMIT $2`,
    ...(end ? [start, limit, end] : [start, limit])
  );
  return rows.map((r) => ({
    userId: r.userId,
    nickname: r.nickname,
    avatar: r.avatar,
    seconds: Number(r.seconds),
    totalSeconds: Number(r.total_seconds),
    isMe: !!meId && r.userId === meId,
  }));
}

/* ─────────────────── 주간 1~3위 프라임 1주 지급 ─────────────────── */

export const WEEKLY_AWARD_RANKS = 3;
export const WEEKLY_AWARD_DAYS = 7;

export interface WeeklyAwardResult {
  weekStart: string;
  awarded: { rank: number; userId: string; nickname: string; seconds: number }[];
  skipped: number;
}

/**
 * 지난 주 1~3위에게 프라임 7일 지급. 같은 주에 두 번 지급하지 않는다(PK 로 막는다).
 * 결제 구독 중이면 grantFreePremiumDays 가 구독 종료 뒤로 이어 붙인다.
 */
export async function awardWeeklyTop(offsetWeeks = -1): Promise<WeeklyAwardResult> {
  await ensure();
  const start = weekStartKst(offsetWeeks);
  const weekStartStr = new Date(start.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const top = await getWeeklyRanking(null, WEEKLY_AWARD_RANKS, offsetWeeks);
  const awarded: WeeklyAwardResult["awarded"] = [];
  let skipped = 0;
  for (let i = 0; i < top.length; i++) {
    const u = top[i];
    const rank = i + 1;
    const inserted = await prisma.$executeRawUnsafe(
      `INSERT INTO "WeeklyStudyAward" ("week_start","user_id","rank","seconds","days")
       VALUES ($1::date,$2,$3,$4,$5) ON CONFLICT ("week_start","user_id") DO NOTHING`,
      weekStartStr, u.userId, rank, u.seconds, WEEKLY_AWARD_DAYS
    );
    if (!inserted) { skipped++; continue; } // 이미 지급됨
    await grantFreePremiumDays(u.userId, WEEKLY_AWARD_DAYS, "weekly_rank");
    awarded.push({ rank, userId: u.userId, nickname: u.nickname, seconds: u.seconds });
  }
  return { weekStart: weekStartStr, awarded, skipped };
}

/** 내가 받은 주간 시상 이력(타이머 화면 안내용). */
export async function getMyWeeklyAwards(userId: string, limit = 4) {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ week_start: Date; rank: number; days: number }[]>(
    `SELECT "week_start","rank","days" FROM "WeeklyStudyAward" WHERE "user_id" = $1 ORDER BY "week_start" DESC LIMIT $2`,
    userId, limit
  );
  return rows.map((r) => ({
    weekStart: new Date(r.week_start).toISOString().slice(0, 10),
    rank: r.rank,
    days: r.days,
  }));
}
