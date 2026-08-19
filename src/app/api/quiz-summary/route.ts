import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// OX/단어 세트 목록 화면이 한 번의 호출로 쓰는 "내 학습 요약" 엔드포인트.
// 세트별로 answered(답한 문항 수) / total(실제 문항 수) / completed(제출 여부) / bestPct(최고 정답률)를 함께 준다.
// 기존 /api/ox-progress 와 별개인 이유: 그쪽은 OX 전용에 answered 숫자 하나만 주는 구버전 앱용 계약이라
// 형태를 바꿀 수 없다. 그래서 확장 계약은 이 라우트로 새로 판다(ox-progress 는 그대로 유지).
// 실패해도 목록이 깨지면 안 되므로 항상 200 + 빈 객체로 떨어진다.

export const dynamic = "force-dynamic";

type SummaryEntry = {
  answered: number;
  total: number;
  completed: boolean;
  bestPct: number | null;
};

type SummaryMap = Record<string, SummaryEntry>;

type Acc = {
  answeredSubmitted: number; // 제출 기록(OxAnswer/VocabAnswer)에서 답한 고유 문항 수
  answeredProgress: number; // 진행중 임시저장(QuizProgress)에서 답한 개수
  completed: boolean;
  bestPct: number | null;
};

const NO_STORE = { "Cache-Control": "no-store, must-revalidate" };

function emptyResponse() {
  return NextResponse.json({ ox: {}, vocab: {} }, { headers: NO_STORE });
}

// COUNT(*) 는 bigint 로 오므로 반드시 Number 로 낮춘다(그대로면 JSON 직렬화가 터진다).
function toNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(typeof value === "bigint" ? Number(value) : value);
  return Number.isFinite(n) ? n : null;
}

// answersJson 은 `[[questionId,{selected,isCorrect}],...]` 문자열. 배열 길이가 진행중 답한 개수다.
// 깨진 행 하나가 응답 전체를 죽이면 안 되므로 파싱 실패는 개별적으로 흡수하고 0으로 본다.
function countProgressAnswers(answersJson: unknown): number {
  if (typeof answersJson !== "string") return 0;
  try {
    const parsed = JSON.parse(answersJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getAcc(map: Map<string, Acc>, setId: string): Acc {
  let acc = map.get(setId);
  if (!acc) {
    acc = { answeredSubmitted: 0, answeredProgress: 0, completed: false, bestPct: null };
    map.set(setId, acc);
  }
  return acc;
}

// 기록이 있는 세트에 대해서만 실제 문항 수를 센다(세트 전수 조회 금지).
// ids 가 비면 쿼리 자체를 건너뛴다.
async function countQuestions(
  table: "OxQuestion" | "VocabQuestion",
  column: "oxQuizSetId" | "vocabQuizSetId",
  ids: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<{ set_id: string; total: bigint }[]>(
    `
      SELECT "${column}" AS set_id, COUNT(*) AS total
      FROM "${table}"
      WHERE "${column}" IN (${placeholders})
      GROUP BY "${column}"
    `,
    ...ids
  );
  for (const row of rows) result.set(row.set_id, toNum(row.total));
  return result;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return emptyResponse();

    const oxAcc = new Map<string, Acc>();
    const vocabAcc = new Map<string, Acc>();
    const bucketOf = (kind: string) => (kind === "vocab" ? vocabAcc : oxAcc);

    const [attemptRows, answeredRows, progressRows] = await Promise.all([
      // 1) 제출(QuizAttempt) 집계: 세트별 제출 존재 여부 + 최고 정답률. ox/vocab 을 UNION ALL 로 한 번에.
      prisma.$queryRawUnsafe<{ kind: string; set_id: string; attempts: bigint; best_pct: number | null }[]>(
        `
          SELECT 'ox' AS kind,
                 t."oxQuizSetId" AS set_id,
                 COUNT(*) AS attempts,
                 MAX(CASE WHEN t."totalScore" > 0
                          THEN ROUND(t."score"::numeric * 100 / t."totalScore")::int
                     END) AS best_pct
          FROM "QuizAttempt" t
          WHERE t."userId" = $1 AND t."oxQuizSetId" IS NOT NULL
          GROUP BY t."oxQuizSetId"
          UNION ALL
          SELECT 'vocab' AS kind,
                 t."vocabQuizSetId" AS set_id,
                 COUNT(*) AS attempts,
                 MAX(CASE WHEN t."totalScore" > 0
                          THEN ROUND(t."score"::numeric * 100 / t."totalScore")::int
                     END) AS best_pct
          FROM "QuizAttempt" t
          WHERE t."userId" = $1 AND t."vocabQuizSetId" IS NOT NULL
          GROUP BY t."vocabQuizSetId"
        `,
        user.id
      ),
      // 2) 답안(OxAnswer/VocabAnswer) 집계: 세트별 답한 고유 문항 수.
      //    답안 테이블엔 userId 가 없어서 attemptId → QuizAttempt.userId 로만 사용자를 판별한다.
      prisma.$queryRawUnsafe<{ kind: string; set_id: string; answered: bigint }[]>(
        `
          SELECT 'ox' AS kind,
                 q."oxQuizSetId" AS set_id,
                 COUNT(DISTINCT a."questionId") AS answered
          FROM "OxAnswer" a
          JOIN "OxQuestion" q ON q."id" = a."questionId"
          JOIN "QuizAttempt" t ON t."id" = a."attemptId"
          WHERE t."userId" = $1
          GROUP BY q."oxQuizSetId"
          UNION ALL
          SELECT 'vocab' AS kind,
                 q."vocabQuizSetId" AS set_id,
                 COUNT(DISTINCT a."questionId") AS answered
          FROM "VocabAnswer" a
          JOIN "VocabQuestion" q ON q."id" = a."questionId"
          JOIN "QuizAttempt" t ON t."id" = a."attemptId"
          WHERE t."userId" = $1
          GROUP BY q."vocabQuizSetId"
        `,
        user.id
      ),
      // 3) 진행중 임시저장. QuizProgress 는 raw SQL 테이블이라 아직 없을 수 있어 여기만 따로 감싼다.
      prisma
        .$queryRawUnsafe<{ quizKey: string; answersJson: string }[]>(
          `SELECT "quizKey", "answersJson" FROM "QuizProgress" WHERE "userId" = $1`,
          user.id
        )
        .catch(() => [] as { quizKey: string; answersJson: string }[]),
    ]);

    for (const row of attemptRows) {
      if (!row.set_id) continue;
      const acc = getAcc(bucketOf(row.kind), row.set_id);
      if (toNum(row.attempts) > 0) acc.completed = true;
      const pct = toNumOrNull(row.best_pct); // totalScore=0 인 제출은 SQL 에서 이미 제외됨
      if (pct !== null) acc.bestPct = acc.bestPct === null ? pct : Math.max(acc.bestPct, pct);
    }

    for (const row of answeredRows) {
      if (!row.set_id) continue;
      const acc = getAcc(bucketOf(row.kind), row.set_id);
      acc.answeredSubmitted = Math.max(acc.answeredSubmitted, toNum(row.answered));
    }

    for (const row of progressRows) {
      const key = typeof row.quizKey === "string" ? row.quizKey : "";
      const sep = key.indexOf(":");
      if (sep <= 0) continue;
      const kind = key.slice(0, sep);
      const setId = key.slice(sep + 1);
      // workbook:* 등 다른 접두사는 이 요약의 대상이 아니다.
      if ((kind !== "ox" && kind !== "vocab") || !setId) continue;
      const acc = getAcc(bucketOf(kind), setId);
      acc.answeredProgress = Math.max(acc.answeredProgress, countProgressAnswers(row.answersJson));
    }

    // 4) 기록이 있는 세트의 실제 문항 수(라이브 COUNT). 비정규화 totalQuestions 는 드리프트가 있어 쓰지 않는다.
    const [oxTotals, vocabTotals] = await Promise.all([
      countQuestions("OxQuestion", "oxQuizSetId", [...oxAcc.keys()]),
      countQuestions("VocabQuestion", "vocabQuizSetId", [...vocabAcc.keys()]),
    ]);

    // 기록이 있는 세트만 내려보낸다(answered>0 또는 completed). 키가 없으면 화면이 '미시작'으로 렌더한다.
    const build = (accMap: Map<string, Acc>, totals: Map<string, number>): SummaryMap => {
      const out: SummaryMap = {};
      for (const [setId, acc] of accMap) {
        const answered = Math.max(acc.answeredSubmitted, acc.answeredProgress);
        if (answered <= 0 && !acc.completed) continue;
        out[setId] = {
          answered,
          total: totals.get(setId) ?? 0,
          completed: acc.completed,
          bestPct: acc.bestPct,
        };
      }
      return out;
    };

    return NextResponse.json(
      { ox: build(oxAcc, oxTotals), vocab: build(vocabAcc, vocabTotals) },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("quiz-summary GET error:", error);
    return emptyResponse();
  }
}
