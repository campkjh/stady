import { prisma } from "@/lib/prisma";
import { ensureDailyQuizTable } from "@/lib/daily-quiz";
import { ensureMockExamTables } from "@/lib/mockExam";
import { ensureMockExamQuestionTables } from "@/lib/mockExamQuestion";
import { subjectLabel, subjectGroupOf } from "@/lib/examSubjects";
// 페이지 체류 로그는 별도 모듈이 수집한다. 배포 직후에는 아직 아무것도 쌓이지 않아
// 빈 배열이 돌아올 수 있고, 화면은 그때 "수집 중" 안내를 띄운다.
import { getPageDwellStats, getHourlyActivity as getPageviewHourly } from "@/lib/pageview";

// 어드민 인사이트 집계.
//
// 원칙 두 가지.
//  1) 기간(days) 필터는 반드시 SQL 안에 넣는다. OxAnswer 는 100만 행대라 전량을 끌어와
//     JS 에서 자르면 그대로 죽는다. TOP 목록은 SQL 에서 LIMIT 까지 걸어 잘라 온다.
//  2) 시간 축은 전부 KST 로 변환한다. 컬럼이 전부 timezone 없는 UTC 타임스탬프라
//     (Prisma DateTime = timestamp(3), raw 테이블도 TIMESTAMP) 그대로 EXTRACT 하면
//     그래프가 9시간 밀린다. `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'` 로 못박는다.
//
// days 는 아래 화이트리스트로만 들어오므로 SQL 문자열에 직접 넣어도 안전하다
// (community.ts 의 인기글 집계와 같은 방식).

export const INSIGHT_DAY_OPTIONS = [7, 30, 90] as const;
export type InsightDays = (typeof INSIGHT_DAY_OPTIONS)[number];

export function parseInsightDays(raw: string | null | undefined): InsightDays {
  const n = Number(raw);
  return (INSIGHT_DAY_OPTIONS as readonly number[]).includes(n) ? (n as InsightDays) : 30;
}

// KST 시(0~23) 추출식. 컬럼명은 큰따옴표를 포함해 넘긴다.
function kstHour(col: string) {
  return `EXTRACT(HOUR FROM (${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'))::int`;
}

function since(days: InsightDays) {
  return `NOW() - (INTERVAL '1 day' * ${days})`;
}

function n(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function nOrNull(value: bigint | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

export interface InsightSummary {
  activeUsers: number;
  quizSubmissions: number;
  quizUsers: number;
  dailyAnswers: number;
  dailyUsers: number;
  dailyCorrectRate: number | null;
  mockAnswers: number;
  mockUsers: number;
  studySessions: number;
  studyMinutes: number;
  /** 페이지 체류 로그가 쌓였을 때만 값이 있다. */
  avgDwellSeconds: number | null;
  pageViews: number;
}

export interface HourlyRow {
  hour: number;
  /** 퀴즈 세트 제출 */
  quiz: number;
  /** OX 문항 풀이(제출 회차 시각 기준) */
  ox: number;
  /** 데일리 퀴즈 응답 */
  daily: number;
  /** 공부 타이머 시작 */
  study: number;
  /** 페이지 조회(수집 전이면 0) */
  pageViews: number;
  total: number;
}

export interface DwellRow {
  path: string;
  views: number;
  totalMinutes: number;
  avgSeconds: number;
  users: number;
}

export interface QuizTypeRow {
  quizType: string;
  label: string;
  attempts: number;
  users: number;
}

export interface SetRow {
  id: string;
  title: string;
  categoryName: string;
  attempts: number;
  users: number;
  avgPct: number | null;
}

export interface CategoryRow {
  name: string;
  attempts: number;
  users: number;
}

export interface QuestionRow {
  id: string;
  question: string;
  setTitle: string;
  categoryName: string;
  answered: number;
  correct: number;
  correctRate: number;
}

export interface MockSubjectRow {
  subject: string;
  label: string;
  groupLabel: string;
  answers: number;
  users: number;
  exams: number;
}

export interface InsightsPayload {
  days: InsightDays;
  generatedAt: string;
  summary: InsightSummary;
  hourly: HourlyRow[];
  dwell: DwellRow[];
  /** 체류 로그가 한 건이라도 있으면 true. false 면 화면이 "수집 중" 안내를 띄운다. */
  dwellAvailable: boolean;
  quizTypes: QuizTypeRow[];
  popularOxSets: SetRow[];
  popularVocabSets: SetRow[];
  oxCategories: CategoryRow[];
  popularQuestions: QuestionRow[];
  hardQuestions: QuestionRow[];
  mockSubjects: MockSubjectRow[];
}

const QUIZ_TYPE_LABEL: Record<string, string> = {
  ox: "OX 퀴즈",
  vocab: "영단어 퀴즈",
  workbook: "문제집",
};

type CountRow = { c: bigint | number };
type HourCountRow = { hour: number; c: bigint | number };

// 페이지 체류 집계는 아직 수집기가 배포되지 않았을 수 있다(테이블 없음 → 쿼리 에러).
// 인사이트 화면 전체가 같이 죽으면 안 되므로 여기서 삼켜 빈 배열로 떨어뜨린다.
async function safeDwell(days: InsightDays): Promise<DwellRow[]> {
  try {
    const rows = await getPageDwellStats(days);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safePageviewHourly(days: InsightDays): Promise<{ hour: number; views: number }[]> {
  try {
    const rows = await getPageviewHourly(days);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function getInsights(days: InsightDays): Promise<InsightsPayload> {
  // raw SQL 로 관리하는 테이블들은 조회 전에 존재를 보장한다(없으면 relation 에러).
  await Promise.all([
    ensureDailyQuizTable(),
    ensureMockExamTables(),
    ensureMockExamQuestionTables(),
  ]);

  const cut = since(days);

  const [
    activeUserRows,
    quizSummaryRows,
    dailySummaryRows,
    mockSummaryRows,
    studySummaryRows,
    quizHourRows,
    oxHourRows,
    dailyHourRows,
    studyHourRows,
    quizTypeRows,
    oxSetRows,
    vocabSetRows,
    oxCategoryRows,
    questionRows,
    mockSubjectRows,
    dwell,
    pageviewHourly,
  ] = await Promise.all([
    // ① 기간 내 활성 사용자: 네 갈래 활동(세트 제출·데일리·모의고사·타이머)의 합집합 인원.
    prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT COUNT(*)::bigint AS c FROM (
        SELECT "userId" AS id FROM "QuizAttempt" WHERE "completedAt" >= ${cut}
        UNION
        SELECT "user_id" FROM "DailyQuizAnswer" WHERE "created_at" >= ${cut}
        UNION
        SELECT "user_id" FROM "MockExamAnswer" WHERE "updated_at" >= ${cut}
        UNION
        SELECT "userId" FROM "StudySession" WHERE "startedAt" >= ${cut}
      ) u
    `),

    // ② 총 제출 수/제출 인원. totalScore = 0 은 책갈피 복습이라 세트 제출이 아니다(게이트 필수).
    prisma.$queryRawUnsafe<{ c: bigint; users: bigint }[]>(`
      SELECT COUNT(*)::bigint AS c, COUNT(DISTINCT "userId")::bigint AS users
        FROM "QuizAttempt"
       WHERE "completedAt" >= ${cut} AND "totalScore" > 0
    `),

    // ③ 데일리 퀴즈 참여량과 정답률.
    prisma.$queryRawUnsafe<{ c: bigint; users: bigint; correct: bigint }[]>(`
      SELECT COUNT(*)::bigint AS c,
             COUNT(DISTINCT "user_id")::bigint AS users,
             COALESCE(SUM(CASE WHEN "is_correct" THEN 1 ELSE 0 END), 0)::bigint AS correct
        FROM "DailyQuizAnswer"
       WHERE "created_at" >= ${cut}
    `),

    // ④ 모의고사 답안 수/응시 인원.
    prisma.$queryRawUnsafe<{ c: bigint; users: bigint }[]>(`
      SELECT COUNT(*)::bigint AS c, COUNT(DISTINCT "user_id")::bigint AS users
        FROM "MockExamAnswer"
       WHERE "updated_at" >= ${cut}
    `),

    // ⑤ 공부 타이머 총량(분)과 세션 수.
    prisma.$queryRawUnsafe<{ sessions: bigint; minutes: number | null }[]>(`
      SELECT COUNT(*)::bigint AS sessions,
             ROUND(COALESCE(SUM("totalSeconds"), 0) / 60.0)::int AS minutes
        FROM "StudySession"
       WHERE "startedAt" >= ${cut}
    `),

    // ⑥ 시간대(KST) × 세트 제출.
    prisma.$queryRawUnsafe<HourCountRow[]>(`
      SELECT ${kstHour('"completedAt"')} AS hour, COUNT(*)::bigint AS c
        FROM "QuizAttempt"
       WHERE "completedAt" >= ${cut}
       GROUP BY 1
    `),

    // ⑦ 시간대(KST) × OX 문항 풀이. 문항 행에는 시각이 없어 회차(attempt) 시각으로 센다.
    prisma.$queryRawUnsafe<HourCountRow[]>(`
      SELECT ${kstHour('t."completedAt"')} AS hour, COUNT(*)::bigint AS c
        FROM "OxAnswer" a
        JOIN "QuizAttempt" t ON t."id" = a."attemptId"
       WHERE t."completedAt" >= ${cut}
       GROUP BY 1
    `),

    // ⑧ 시간대(KST) × 데일리 퀴즈 응답.
    prisma.$queryRawUnsafe<HourCountRow[]>(`
      SELECT ${kstHour('"created_at"')} AS hour, COUNT(*)::bigint AS c
        FROM "DailyQuizAnswer"
       WHERE "created_at" >= ${cut}
       GROUP BY 1
    `),

    // ⑨ 시간대(KST) × 공부 타이머 시작.
    prisma.$queryRawUnsafe<HourCountRow[]>(`
      SELECT ${kstHour('"startedAt"')} AS hour, COUNT(*)::bigint AS c
        FROM "StudySession"
       WHERE "startedAt" >= ${cut}
       GROUP BY 1
    `),

    // ⑩ 퀴즈 유형별 제출 수/인원(ox·vocab·workbook 중 무엇을 주로 푸는가).
    prisma.$queryRawUnsafe<{ quizType: string; c: bigint; users: bigint }[]>(`
      SELECT "quizType", COUNT(*)::bigint AS c, COUNT(DISTINCT "userId")::bigint AS users
        FROM "QuizAttempt"
       WHERE "completedAt" >= ${cut} AND "totalScore" > 0
       GROUP BY 1
       ORDER BY c DESC
    `),

    // ⑪ 인기 OX 세트 TOP 10(제출 회차·응시자·평균 점수).
    prisma.$queryRawUnsafe<{ id: string; title: string; category_name: string | null; attempts: bigint; users: bigint; avg_pct: number | null }[]>(`
      SELECT s."id" AS id,
             s."title" AS title,
             c."name" AS category_name,
             COUNT(*)::bigint AS attempts,
             COUNT(DISTINCT t."userId")::bigint AS users,
             ROUND(AVG(t."score"::numeric * 100 / t."totalScore"))::int AS avg_pct
        FROM "QuizAttempt" t
        JOIN "OxQuizSet" s ON s."id" = t."oxQuizSetId"
        LEFT JOIN "Category" c ON c."id" = s."categoryId"
       WHERE t."completedAt" >= ${cut} AND t."totalScore" > 0
       GROUP BY s."id", s."title", c."name"
       ORDER BY attempts DESC
       LIMIT 10
    `),

    // ⑫ 인기 영단어 세트 TOP 10.
    prisma.$queryRawUnsafe<{ id: string; title: string; category_name: string | null; attempts: bigint; users: bigint; avg_pct: number | null }[]>(`
      SELECT s."id" AS id,
             s."title" AS title,
             c."name" AS category_name,
             COUNT(*)::bigint AS attempts,
             COUNT(DISTINCT t."userId")::bigint AS users,
             ROUND(AVG(t."score"::numeric * 100 / t."totalScore"))::int AS avg_pct
        FROM "QuizAttempt" t
        JOIN "VocabQuizSet" s ON s."id" = t."vocabQuizSetId"
        LEFT JOIN "Category" c ON c."id" = s."categoryId"
       WHERE t."completedAt" >= ${cut} AND t."totalScore" > 0
       GROUP BY s."id", s."title", c."name"
       ORDER BY attempts DESC
       LIMIT 10
    `),

    // ⑬ OX 를 어느 과목(카테고리)에서 주로 푸는지.
    prisma.$queryRawUnsafe<{ name: string | null; attempts: bigint; users: bigint }[]>(`
      SELECT c."name" AS name,
             COUNT(*)::bigint AS attempts,
             COUNT(DISTINCT t."userId")::bigint AS users
        FROM "QuizAttempt" t
        JOIN "OxQuizSet" s ON s."id" = t."oxQuizSetId"
        LEFT JOIN "Category" c ON c."id" = s."categoryId"
       WHERE t."completedAt" >= ${cut} AND t."totalScore" > 0
       GROUP BY c."name"
       ORDER BY attempts DESC
       LIMIT 10
    `),

    // ⑭ 많이 푼 문항 TOP 15 + 정답률 낮은(어려운) 문항 TOP 15.
    //    OxAnswer 를 두 번 훑지 않도록 집계 CTE 하나를 두 갈래로 잘라 쓴다.
    //    분모는 selected IS NOT NULL 인 응답만 — 무응답을 분모에 넣으면 정답률이 왜곡된다.
    //    어려운 문항은 표본 20건 이상만(우연히 두세 명이 틀린 문항이 1위로 올라오는 걸 막는다).
    prisma.$queryRawUnsafe<{ bucket: string; id: string; question: string; set_title: string; category_name: string | null; answered: bigint; correct: bigint }[]>(`
      WITH agg AS (
        SELECT a."questionId" AS question_id,
               COUNT(*)::bigint AS answered,
               COALESCE(SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END), 0)::bigint AS correct
          FROM "OxAnswer" a
          JOIN "QuizAttempt" t ON t."id" = a."attemptId"
         WHERE t."completedAt" >= ${cut} AND a."selected" IS NOT NULL
         GROUP BY a."questionId"
      ),
      picked AS (
        (SELECT 'popular' AS bucket, question_id, answered, correct
           FROM agg ORDER BY answered DESC LIMIT 15)
        UNION ALL
        (SELECT 'hard' AS bucket, question_id, answered, correct
           FROM agg WHERE answered >= 20
          ORDER BY (correct::numeric / answered) ASC, answered DESC LIMIT 15)
      )
      SELECT p.bucket AS bucket,
             q."id" AS id,
             q."question" AS question,
             s."title" AS set_title,
             c."name" AS category_name,
             p.answered AS answered,
             p.correct AS correct
        FROM picked p
        JOIN "OxQuestion" q ON q."id" = p.question_id
        JOIN "OxQuizSet" s ON s."id" = q."oxQuizSetId"
        LEFT JOIN "Category" c ON c."id" = s."categoryId"
       ORDER BY p.bucket, p.answered DESC
    `),

    // ⑮ 모의고사 과목별 응시(답안 수·응시자·시험지 수). 과목은 사이드카 테이블 MockExamMeta.
    prisma.$queryRawUnsafe<{ subject: string | null; answers: bigint; users: bigint; exams: bigint }[]>(`
      SELECT m."subject" AS subject,
             COUNT(*)::bigint AS answers,
             COUNT(DISTINCT a."user_id")::bigint AS users,
             COUNT(DISTINCT a."exam_id")::bigint AS exams
        FROM "MockExamAnswer" a
        LEFT JOIN "MockExamMeta" m ON m."exam_id" = a."exam_id"
       WHERE a."updated_at" >= ${cut}
       GROUP BY m."subject"
       ORDER BY answers DESC
       LIMIT 20
    `),

    safeDwell(days),
    safePageviewHourly(days),
  ]);

  const hourMap = (rows: HourCountRow[]) => {
    const map = new Map<number, number>();
    for (const r of rows) map.set(Number(r.hour), n(r.c));
    return map;
  };
  const quizByHour = hourMap(quizHourRows);
  const oxByHour = hourMap(oxHourRows);
  const dailyByHour = hourMap(dailyHourRows);
  const studyByHour = hourMap(studyHourRows);
  const viewByHour = new Map<number, number>();
  for (const r of pageviewHourly) viewByHour.set(Number(r.hour), n(r.views));

  const hourly: HourlyRow[] = Array.from({ length: 24 }, (_, hour) => {
    const quiz = quizByHour.get(hour) ?? 0;
    const ox = oxByHour.get(hour) ?? 0;
    const daily = dailyByHour.get(hour) ?? 0;
    const study = studyByHour.get(hour) ?? 0;
    const pageViews = viewByHour.get(hour) ?? 0;
    return { hour, quiz, ox, daily, study, pageViews, total: quiz + ox + daily + study + pageViews };
  });

  const dailyTotal = n(dailySummaryRows[0]?.c);
  const dailyCorrect = n(dailySummaryRows[0]?.correct);

  const dwellViews = dwell.reduce((sum, row) => sum + n(row.views), 0);
  const dwellSeconds = dwell.reduce((sum, row) => sum + n(row.totalMinutes) * 60, 0);

  const summary: InsightSummary = {
    activeUsers: n(activeUserRows[0]?.c),
    quizSubmissions: n(quizSummaryRows[0]?.c),
    quizUsers: n(quizSummaryRows[0]?.users),
    dailyAnswers: dailyTotal,
    dailyUsers: n(dailySummaryRows[0]?.users),
    dailyCorrectRate: dailyTotal > 0 ? Math.round((dailyCorrect * 100) / dailyTotal) : null,
    mockAnswers: n(mockSummaryRows[0]?.c),
    mockUsers: n(mockSummaryRows[0]?.users),
    studySessions: n(studySummaryRows[0]?.sessions),
    studyMinutes: n(studySummaryRows[0]?.minutes),
    avgDwellSeconds: dwellViews > 0 ? Math.round(dwellSeconds / dwellViews) : null,
    pageViews: dwellViews,
  };

  const mapSet = (rows: { id: string; title: string; category_name: string | null; attempts: bigint; users: bigint; avg_pct: number | null }[]): SetRow[] =>
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      categoryName: r.category_name || "미분류",
      attempts: n(r.attempts),
      users: n(r.users),
      avgPct: nOrNull(r.avg_pct),
    }));

  const mapQuestion = (bucket: string): QuestionRow[] =>
    questionRows
      .filter((r) => r.bucket === bucket)
      .map((r) => {
        const answered = n(r.answered);
        const correct = n(r.correct);
        return {
          id: r.id,
          question: r.question,
          setTitle: r.set_title,
          categoryName: r.category_name || "미분류",
          answered,
          correct,
          correctRate: answered > 0 ? Math.round((correct * 100) / answered) : 0,
        };
      });

  const popularQuestions = mapQuestion("popular").sort((a, b) => b.answered - a.answered);
  const hardQuestions = mapQuestion("hard").sort((a, b) => a.correctRate - b.correctRate || b.answered - a.answered);

  return {
    days,
    generatedAt: new Date().toISOString(),
    summary,
    hourly,
    dwell: dwell.map((r) => ({
      path: r.path,
      views: n(r.views),
      totalMinutes: n(r.totalMinutes),
      avgSeconds: n(r.avgSeconds),
      users: n(r.users),
    })),
    dwellAvailable: dwell.length > 0,
    quizTypes: quizTypeRows.map((r) => ({
      quizType: r.quizType,
      label: QUIZ_TYPE_LABEL[r.quizType] || r.quizType,
      attempts: n(r.c),
      users: n(r.users),
    })),
    popularOxSets: mapSet(oxSetRows),
    popularVocabSets: mapSet(vocabSetRows),
    oxCategories: oxCategoryRows.map((r) => ({
      name: r.name || "미분류",
      attempts: n(r.attempts),
      users: n(r.users),
    })),
    popularQuestions,
    hardQuestions,
    mockSubjects: mockSubjectRows.map((r) => ({
      subject: r.subject || "",
      label: subjectLabel(r.subject) || "미분류",
      groupLabel: subjectGroupOf(r.subject)?.label || "미분류",
      answers: n(r.answers),
      users: n(r.users),
      exams: n(r.exams),
    })),
  };
}
