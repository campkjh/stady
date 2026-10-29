// 수능대비자료 — 생활과 윤리 사상가별 파이널 선지(프리미엄 전용) → OX 세트 등록.
//   node scripts/csat-final/import.mjs            (미리보기)
//   node scripts/csat-final/import.mjs --apply    (실제 등록)
//
// items.json = 해설 PDF('생활과윤리_사상가별_선지해설')를 extract_rows.py → parse_items.py 로 뽑은 것
//   (757문항 · 6단원 · 28사상가, 정답은 PDF 앞쪽 정답지와 전부 대조해 일치 확인).
// 단원 하나 = OX 세트 하나(제목 '파이널 선지 · 단원'), 소분류(section) = 사상가.
// 세트는 OxSetCollection('csat-final')에 묶여 일반 OX 목록에서 빠지고 전부 프리미엄 잠금(lib/csatPrep·premiumGate).
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const CATEGORY = "생활과윤리";
const COLLECTION = "csat-final";
const items = JSON.parse(readFileSync(new URL("./items.json", import.meta.url), "utf8"));
const prisma = new PrismaClient();

// '2021학년도 9월 모평 7번' → '21학년도 9월 모평 7번'(기존 OX 출처 표기 '27학년도 6월'과 같은 결)
const shortSrc = (s) => (s ? s.replace(/^20(\d\d)학년도/, "$1학년도") : null);

async function main() {
  const units = [];
  for (const it of items) {
    let u = units.find((x) => x.name === it.unit);
    if (!u) units.push((u = { name: it.unit, rows: [] }));
    u.rows.push(it);
  }
  const category = await prisma.category.findFirst({ where: { name: CATEGORY } });
  if (!category) throw new Error(`${CATEGORY} 카테고리 없음`);
  const titles = units.map((u) => `파이널 선지 · ${u.name}`);
  const dup = await prisma.oxQuizSet.findMany({ where: { title: { in: titles } }, select: { title: true } });
  for (const [i, u] of units.entries()) {
    const thinkers = [...new Set(u.rows.map((r) => r.thinker.replace(/\s*\d+개$/, "")))];
    console.log(`${titles[i]} — ${u.rows.length}문항 · ${thinkers.join(", ")}`);
  }
  console.log(`총 ${items.length}문항 / 기존 동명 세트 ${dup.length}개`);
  if (!APPLY) { console.log("\n미리보기입니다. --apply 로 실제 등록."); return; }
  if (dup.length) throw new Error(`이미 있는 세트: ${dup.map((d) => d.title).join(", ")}`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OxSetCollection" (
      "set_id" TEXT PRIMARY KEY REFERENCES "OxQuizSet"("id") ON DELETE CASCADE,
      "collection" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  for (const [i, u] of units.entries()) {
    const setId = randomUUID();
    await prisma.$transaction([
      prisma.oxQuizSet.create({
        data: { id: setId, title: titles[i], categoryId: category.id, difficulty: "어려움", totalQuestions: u.rows.length },
      }),
      prisma.oxQuestion.createMany({
        data: u.rows.map((r, k) => ({
          id: randomUUID(),
          oxQuizSetId: setId,
          order: k + 1,
          section: r.thinker.replace(/\s*\d+개$/, ""),
          // 제시문이 딸린 선지(노직 S₁~S₄)는 제시문을 앞에 붙인다 — 풀이 화면 제목이 한 줄 글이라 줄바꿈 대신 구분 기호.
          question: r.context ? `[제시문] ${r.context.replace(/^\(나\)\s*/, "")} ▶ ${r.question}` : r.question,
          answer: r.answer === "O",
          explanation: r.explanation || null,
          examYearMonth: shortSrc(r.src),
          answerRate: r.rate ?? null,
        })),
      }),
      prisma.$executeRawUnsafe(
        `INSERT INTO "OxSetCollection" ("set_id","collection","sort_order") VALUES ($1,$2,$3)`,
        setId, COLLECTION, i + 1
      ),
    ]);
    console.log(`등록 ${titles[i]} (${setId})`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
