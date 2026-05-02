import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const prisma = new PrismaClient();

const TITLES = [
  "윤리학의 분류",
  "동양 윤리",
  "서양 윤리",
  "동양 죽음관",
  "서양 죽음관",
  "동양 직업관",
  "서양 직업관",
  "분배 정의",
];

async function main() {
  const raw = JSON.parse(readFileSync(new URL("./ox-import-data.json", import.meta.url), "utf8"));
  const cat = await prisma.category.findFirst({ where: { name: "생활과윤리" } });
  if (!cat) {
    console.log("MISSING category: 생활과윤리");
    process.exitCode = 1;
    return;
  }

  console.log(`category: ${cat?.name} (${cat?.id})`);
  const expectedTotal = TITLES.reduce((sum, title) => sum + raw.groups[title].length, 0);
  let totalQ = 0;
  let hasMismatch = false;
  for (const title of TITLES) {
    const expected = raw.groups[title];
    const set = await prisma.oxQuizSet.findFirst({
      where: { title, categoryId: cat.id },
      include: { _count: { select: { questions: true } } },
    });
    if (!set) {
      console.log(`MISSING: ${title}`);
      hasMismatch = true;
      continue;
    }
    const questions = await prisma.oxQuestion.findMany({
      where: { oxQuizSetId: set.id },
      orderBy: { order: "asc" },
      select: { question: true, answer: true, section: true },
    });
    const sample = questions[0];
    const nullSections = questions.filter((q) => !q.section).length;
    const dbSections = new Set(questions.map((q) => q.section).filter(Boolean)).size;
    const expectedSections = new Set(expected.map((q) => q.s).filter(Boolean)).size;
    const countOk = questions.length === expected.length && set.totalQuestions === expected.length;
    const sectionOk = nullSections === 0 && dbSections === expectedSections;
    if (!countOk || !sectionOk) hasMismatch = true;
    console.log(
      `${countOk && sectionOk ? "OK" : "WARN"} ${title}: expected=${expected.length}, totalQuestions=${set.totalQuestions}, actual=${set._count.questions}, sections=${dbSections}/${expectedSections}, nullSections=${nullSections}, first="${sample?.question?.slice(0, 30)}..." ans=${sample?.answer ? "O" : "X"}`
    );
    totalQ += set._count.questions;
  }
  console.log(`---\ntotal questions across 8 sets: ${totalQ}/${expectedTotal}`);
  if (totalQ !== expectedTotal || hasMismatch) process.exitCode = 1;
}

main().catch(console.error).finally(() => prisma.$disconnect());
