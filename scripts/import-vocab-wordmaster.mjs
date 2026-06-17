import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";

const p = new PrismaClient();

const FILE = "/Users/jeonghunjeonghun-a.../Downloads/워드마스터_수능_다의어분리.xlsx";
const TITLE = "워드마스터 수능 다의어분리";
// VocabQuizSet requires a categoryId (FK). The vocab intro lists sets by title,
// so the category isn't shown — reuse the same category as 수능 빈출 영단어.
const CATEGORY_ID = "d2ac7ef7-fd85-404e-9afa-47b25581bf48"; // 생활과윤리

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wb = xlsx.readFile(FILE);

// Combine every DAY sheet (DAY 01 ~ DAY 50) in order.
// DAY sheet columns: 번호, 영단어, 뜻, 오답1, 오답2, 오답3
const dayNames = wb.SheetNames.filter((n) => /^DAY/.test(n));
const questions = [];
let skipped = 0;
for (const name of dayNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }).slice(1);
  for (const r of rows) {
    const word = String(r[1]).trim();
    const correct = String(r[2]).trim();
    if (!word || !correct) continue;
    const wrongs = [r[3], r[4], r[5]].map((x) => String(x).trim()).filter(Boolean);
    const distinctWrongs = [...new Set(wrongs.filter((w) => w !== correct))];
    if (distinctWrongs.length < 3) {
      skipped++;
      continue;
    }
    const choices = shuffle([correct, distinctWrongs[0], distinctWrongs[1], distinctWrongs[2]]);
    questions.push({
      order: questions.length + 1,
      word,
      choice1: choices[0],
      choice2: choices[1],
      choice3: choices[2],
      choice4: choices[3],
      answer: choices.indexOf(correct) + 1,
    });
  }
}

// Replace any existing set with this title (the earlier 454-question import).
const existing = await p.vocabQuizSet.findFirst({ where: { title: TITLE } });
if (existing) {
  await p.vocabQuestion.deleteMany({ where: { vocabQuizSetId: existing.id } });
  await p.vocabQuizSet.delete({ where: { id: existing.id } });
  console.log(`🗑  기존 세트 삭제: ${existing.id}`);
}

const set = await p.vocabQuizSet.create({
  data: { title: TITLE, categoryId: CATEGORY_ID, difficulty: "보통", totalQuestions: questions.length, isPopular: false },
});
await p.vocabQuestion.createMany({
  data: questions.map((q) => ({ vocabQuizSetId: set.id, ...q })),
});

console.log(`✅ 생성: "${TITLE}" — ${questions.length}문항 (DAY ${dayNames.length}개, skipped ${skipped}) → ${set.id}`);
await p.$disconnect();
