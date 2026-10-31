// 수능대비자료 — 윤리와 사상 사상가별 고난도 선지(프리미엄 전용) → OX 세트 등록.
//   node scripts/csat-final/ethics-thought/import.mjs            (미리보기)
//   node scripts/csat-final/ethics-thought/import.mjs --apply    (실제 등록)
//
// items.json = 해설 PDF('윤리와사상_사상가별_고난도선지_2_해설')를 parse.py 로 뽑은 것
//   (1,073선지 · 3단원 · 68사상가, 정답은 PDF 앞쪽 정답지와 전부 대조해 일치 확인).
// 단원 하나 = OX 세트 하나(제목 '고난도 선지 · 단원'), 소분류(section) = 사상가.
// 세트는 OxSetCollection('csat-ethics-thought')에 묶여 일반 OX 목록에서 빠지고 전부 프리미엄 잠금(lib/csatPrep·premiumGate).
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const CATEGORY = "윤리와사상";
const COLLECTION = "csat-ethics-thought";
const items = JSON.parse(readFileSync(new URL("./items.json", import.meta.url), "utf8"));
const prisma = new PrismaClient();

// '2021학년도 9월 모평 7번' → '21학년도 9월 모평 7번'(생윤 파이널 선지와 같은 표기)
const shortSrc = (s) => (s ? s.replace(/20(\d\d)학년도/g, "$1학년도") : null);

async function main() {
  const units = [];
  for (const it of items) {
    let u = units.find((x) => x.name === it.unit);
    if (!u) units.push((u = { name: it.unit, rows: [] }));
    u.rows.push(it);
  }
  const category = await prisma.category.findFirst({ where: { name: CATEGORY } });
  if (!category) throw new Error(`${CATEGORY} 카테고리 없음`);
  const titles = units.map((u) => `고난도 선지 · ${u.name}`);
  const dup = await prisma.oxQuizSet.findMany({ where: { title: { in: titles } }, select: { title: true } });
  for (const [i, u] of units.entries()) {
    const thinkers = [...new Set(u.rows.map((r) => r.thinker))];
    console.log(`${titles[i]} — ${u.rows.length}문항 · 사상가 ${thinkers.length}명 (${thinkers.slice(0, 6).join(", ")}…)`);
  }
  console.log(`총 ${items.length}문항 / 기존 동명 세트 ${dup.length}개`);
  if (!APPLY) { console.log("\n미리보기입니다. --apply 로 실제 등록."); return; }
  if (dup.length) throw new Error(`이미 있는 세트: ${dup.map((d) => d.title).join(", ")}`);

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
          section: r.thinker,
          question: r.question,
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
