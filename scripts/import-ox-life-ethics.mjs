import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";

const p = new PrismaClient();

const FILE = "/Users/jeonghunjeonghun-a.../Downloads/생활과윤리 OX정리.xlsx";
const TITLE = "생활과윤리 OX정리";
const CATEGORY_ID = "d2ac7ef7-fd85-404e-9afa-47b25581bf48"; // 생활과윤리

function isO(v) {
  const s = String(v).trim().toUpperCase();
  return s === "O" || s === "○";
}
function isX(v) {
  const s = String(v).trim().toUpperCase();
  return s === "X" || s === "✕";
}
// "Ch1 과학 기술과 윤리" -> "과학 기술과 윤리"
function cleanUnit(v) {
  return String(v).trim().replace(/^Ch\s*\d+\s*/i, "").trim();
}

const wb = xlsx.readFile(FILE);
// 단원 시트(1~7) 합본 — "전체" 시트는 7단원이 빠져 불완전하므로 사용 안 함.
// 단원 시트 컬럼: 번호, 단원, 문제번호, 제시문입장, 선지번호, 선지내용, 정답, 해설
const sheets = wb.SheetNames.filter((n) => n !== "전체");
const questions = [];
let skipped = 0;
for (const name of sheets) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }).slice(1);
  for (const r of rows) {
    const stance = String(r[3]).trim();   // 제시문 입장
    const choice = String(r[5]).trim();   // 선지 내용
    const ans = r[6];                       // 정답 O/X
    const expl = String(r[7]).trim();      // 해설
    const unit = cleanUnit(r[1]);          // 단원 -> section
    if (!choice || (!isO(ans) && !isX(ans))) {
      if (choice) skipped++;
      continue;
    }
    const question = stance ? `[${stance}] ${choice}` : choice;
    questions.push({
      order: questions.length + 1,
      section: unit || null,
      question,
      answer: isO(ans),
      explanation: expl || null,
    });
  }
}

// 기존 동일 제목 세트 교체
const existing = await p.oxQuizSet.findFirst({ where: { title: TITLE } });
if (existing) {
  await p.oxAnswer.deleteMany({ where: { question: { oxQuizSetId: existing.id } } });
  await p.bookmark.deleteMany({ where: { oxQuizSetId: existing.id } });
  await p.oxQuestion.deleteMany({ where: { oxQuizSetId: existing.id } });
  await p.oxQuizSet.delete({ where: { id: existing.id } });
  console.log(`🗑  기존 세트 삭제: ${existing.id}`);
}

const set = await p.oxQuizSet.create({
  data: { title: TITLE, categoryId: CATEGORY_ID, difficulty: "보통", totalQuestions: questions.length, isPopular: false },
});
await p.oxQuestion.createMany({
  data: questions.map((q) => ({ oxQuizSetId: set.id, ...q })),
});

const sections = [...new Set(questions.map((q) => q.section))];
console.log(`✅ 생성: "${TITLE}" — ${questions.length}문항 (skipped ${skipped}) → ${set.id}`);
console.log(`섹션(${sections.length}):`, sections.join(", "));
await p.$disconnect();
