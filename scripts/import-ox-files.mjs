import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";

const p = new PrismaClient();

const FILE_ETHICS = "/Users/jeonghunjeonghun-a.../Downloads/윤리와사상 OX파일.xlsx";
const FILE_SOCIETY = "/Users/jeonghunjeonghun-a.../Downloads/통합사회1 OX.xlsx";
const ETHICS_CATEGORY_ID = "0f8aec95-74ac-41a3-af15-bab0a9467ead"; // 윤리와사상

function isO(v) {
  const s = String(v).trim().toUpperCase();
  return s === "O" || s === "○"; // O = true(정답 O), X = false
}

async function importSet({ title, categoryId, rows }) {
  const existing = await p.oxQuizSet.findFirst({ where: { title } });
  if (existing) {
    console.log(`⏭  스킵(이미 존재): "${title}" (${existing.id})`);
    return;
  }
  const set = await p.oxQuizSet.create({
    data: { title, categoryId, difficulty: "보통", totalQuestions: rows.length, isPopular: false },
  });
  await p.oxQuestion.createMany({
    data: rows.map((r, i) => ({
      oxQuizSetId: set.id,
      order: i + 1,
      section: r.section || null,
      question: r.question,
      answer: r.answer,
    })),
  });
  console.log(`✅ 생성: "${title}" — ${rows.length}문항 (${set.id})`);
}

// 1) 통합사회 카테고리 (없으면 생성)
let society = await p.category.findFirst({ where: { name: "통합사회" } });
if (!society) {
  const maxOrder = await p.category.aggregate({ _max: { order: true } });
  society = await p.category.create({
    data: { name: "통합사회", icon: "🌏", order: (maxOrder._max.order ?? 0) + 1, isPopular: false },
  });
  console.log(`✅ 카테고리 생성: 통합사회 (${society.id})`);
} else {
  console.log(`ℹ️  카테고리 존재: 통합사회 (${society.id})`);
}

// 2) 통합사회1 OX (단일 시트: 번호, 문제, 정답)
{
  const wb = xlsx.readFile(FILE_SOCIETY);
  const raw = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = raw
    .slice(1)
    .filter((r) => String(r[1]).trim())
    .map((r) => ({ question: String(r[1]).trim(), answer: isO(r[2]), section: null }));
  await importSet({ title: "통합사회1 OX", categoryId: society.id, rows });
}

// 3) 윤리와 사상 OX (전체 시트: 단원, 번호, 문제, 정답 → 단원을 섹션으로)
{
  const wb = xlsx.readFile(FILE_ETHICS);
  const raw = xlsx.utils.sheet_to_json(wb.Sheets["전체"], { header: 1, defval: "" });
  const rows = raw
    .slice(2)
    .filter((r) => String(r[2]).trim())
    .map((r) => ({ question: String(r[2]).trim(), answer: isO(r[3]), section: String(r[0]).trim() || null }));
  await importSet({ title: "윤리와 사상 OX", categoryId: ETHICS_CATEGORY_ID, rows });
}

await p.$disconnect();
console.log("완료");
