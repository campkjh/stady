// 사상가 퀴즈 임포트 — 엑셀(제시문·보기·정답)을 생활과윤리 OX 세트 뒤에 붙인다.
//   미리보기: node --env-file=.env.local scripts/import-thinker-quiz.mjs <xlsx>
//   실제 적용: APPLY=1 node --env-file=.env.local scripts/import-thinker-quiz.mjs <xlsx>
//
// 엑셀 한 행 = 문제 하나. A열(대단원, 병합이라 첫 행에만 값) / B열 제시문 /
// C~I열 보기 / J열 정답. 같은 세트에 이미 들어간 제시문은 건너뛴다(여러 번 돌려도 안전).
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import xlsx from "xlsx";

const APPLY = process.env.APPLY === "1";
const FILE = process.argv[2];
if (!FILE) {
  console.error("엑셀 경로를 넘겨주세요.");
  process.exit(1);
}

// 엑셀 대단원 → 기존 OX 세트 제목. 동/서양으로 쪼개진 단원은 정답 사상가로 가른다.
const EAST = new Set(["유교", "불교", "도가", "공자", "맹자", "순자", "노자", "장자", "주희", "왕수인"]);
const MAP = {
  "동양 윤리": () => "동양 윤리",
  "서양 윤리": () => "서양 윤리",
  "죽음관": (answer) => (EAST.has(answer) ? "동양 죽음관" : "서양 죽음관"),
  "동서양의 직업관": (answer) => (EAST.has(answer) ? "동양 직업관" : "서양 직업관"),
  "분배적 정의관": () => "분배 정의",
  "교정적 정의": () => "교정적 정의",
  "국가와 시민의 윤리": () => "국가론",
  "시민불복종": () => "시민불복종",
  "자연과 윤리": (answer) => (EAST.has(answer) ? "동양 자연관" : "서양 자연관"),
  "국제 평화": () => "평화론",
  "해외 원조": () => "해외 원조",
};

const prisma = new PrismaClient();

// 앱(src/lib/oxThinker.ts)과 같은 DDL — 스크립트만 먼저 돌려도 되게.
async function ensureTables() {
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
    CREATE INDEX IF NOT EXISTS "OxThinkerQuestion_set_idx" ON "OxThinkerQuestion" ("ox_quiz_set_id", "order")
  `);
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
    CREATE INDEX IF NOT EXISTS "OxThinkerAnswer_question_idx" ON "OxThinkerAnswer" ("question_id")
  `);
}

async function main() {
  await ensureTables();
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // 병합 셀(A열 대단원)은 첫 행에만 값이 있다 — header:1 로 원본 배열 그대로 받는다.
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }).slice(1);

  const category = (
    await prisma.$queryRawUnsafe(`SELECT id FROM "Category" WHERE name = '생활과윤리' LIMIT 1`)
  )[0];
  if (!category) throw new Error("생활과윤리 과목을 찾지 못했습니다.");

  const sets = await prisma.$queryRawUnsafe(
    `SELECT id, title FROM "OxQuizSet" WHERE "categoryId" = $1`,
    category.id
  );
  const setByTitle = new Map(sets.map((s) => [s.title, s.id]));

  // 엑셀 → 세트별 문제 목록
  const bySet = new Map();
  let unit = null;
  let skipped = 0;
  for (const row of rows) {
    if (row[0] && String(row[0]).trim()) unit = String(row[0]).trim();
    const passage = String(row[1] ?? "").trim();
    if (!passage) continue;
    const choices = row.slice(2, 9).map((c) => String(c ?? "").trim()).filter(Boolean);
    const answer = String(row[9] ?? "").trim();
    if (!unit || choices.length < 2 || !answer || !choices.includes(answer)) {
      skipped++;
      continue;
    }
    const pick = MAP[unit];
    if (!pick) {
      skipped++;
      continue;
    }
    const title = pick(answer);
    const setId = setByTitle.get(title);
    if (!setId) {
      skipped++;
      continue;
    }
    if (!bySet.has(setId)) bySet.set(setId, { title, items: [] });
    bySet.get(setId).items.push({ passage, choices, answer });
  }

  let inserted = 0;
  let dup = 0;
  for (const [setId, { title, items }] of bySet) {
    // 이미 들어간 제시문은 건너뛴다.
    const existing = await prisma.$queryRawUnsafe(
      `SELECT "passage", MAX("order")::int AS max_order FROM "OxThinkerQuestion"
       WHERE "ox_quiz_set_id" = $1 GROUP BY "passage"`,
      setId
    );
    const seen = new Set(existing.map((e) => e.passage));
    const startRow = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(MAX("order"), -1)::int AS max_order FROM "OxThinkerQuestion" WHERE "ox_quiz_set_id" = $1`,
      setId
    );
    let order = (startRow[0]?.max_order ?? -1) + 1;

    const fresh = items.filter((it) => !seen.has(it.passage));
    dup += items.length - fresh.length;
    console.log(`${title}: ${fresh.length}문항 추가${items.length - fresh.length ? ` (중복 ${items.length - fresh.length} 건너뜀)` : ""}`);
    if (!APPLY) continue;

    for (const it of fresh) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OxThinkerQuestion" ("id","ox_quiz_set_id","order","passage","choices","answer")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        randomUUID(),
        setId,
        order++,
        it.passage,
        JSON.stringify(it.choices),
        it.answer
      );
      inserted++;
    }
  }

  console.log(
    APPLY
      ? `\n적용 완료 — ${inserted}문항 추가, 중복 ${dup}건 건너뜀, 매칭 실패 ${skipped}행`
      : `\n미리보기 — 추가 예정 ${[...bySet.values()].reduce((s, v) => s + v.items.length, 0)}문항, 매칭 실패 ${skipped}행 (APPLY=1 로 실제 적용)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
