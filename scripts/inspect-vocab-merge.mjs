// READ-ONLY: inspect the two vocab sets to be merged.
// Run: node --env-file=.env.local scripts/inspect-vocab-merge.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TARGET_TITLE = "수능빈출영단어";
const SOURCE_TITLE = "워드마스터 수능 다의어분리";

async function describe(label, title) {
  const sets = await prisma.vocabQuizSet.findMany({
    where: { title: { contains: title } },
    include: { _count: { select: { questions: true } } },
  });
  console.log(`\n[${label}] title contains "${title}" -> ${sets.length} set(s)`);
  for (const s of sets) {
    const agg = await prisma.vocabQuestion.aggregate({
      where: { vocabQuizSetId: s.id },
      _min: { order: true },
      _max: { order: true },
    });
    const bms = await prisma.bookmark.count({ where: { vocabQuizSetId: s.id } });
    const attempts = await prisma.quizAttempt.count({ where: { vocabQuizSetId: s.id } });
    console.log(
      `   id=${s.id}\n     title="${s.title}"  categoryId=${s.categoryId}  totalQuestions(field)=${s.totalQuestions}` +
        `\n     actualQuestions=${s._count.questions}  order[min..max]=${agg._min.order}..${agg._max.order}` +
        `\n     bookmarksRefSet=${bms}  attempts=${attempts}`
    );
  }
  return sets;
}

async function main() {
  console.log("===== Vocab merge inspection (READ ONLY) =====");
  await describe("TARGET", TARGET_TITLE);
  await describe("SOURCE", SOURCE_TITLE);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
