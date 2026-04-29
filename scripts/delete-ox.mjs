import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TARGETS = [
  { category: "사회문화", title: "한국사 OX 퀴즈" },
  { category: "생활과윤리", title: "생활과 윤리 OX 퀴즈" },
];

async function main() {
  for (const t of TARGETS) {
    const cat = await prisma.category.findFirst({ where: { name: t.category } });
    if (!cat) {
      console.log(`SKIP ${t.title}: category "${t.category}" not found`);
      continue;
    }
    const set = await prisma.oxQuizSet.findFirst({
      where: { title: t.title, categoryId: cat.id },
    });
    if (!set) {
      console.log(`SKIP ${t.title}: set not found in "${t.category}"`);
      continue;
    }

    const attemptCount = await prisma.quizAttempt.count({ where: { oxQuizSetId: set.id } });
    const questionCount = await prisma.oxQuestion.count({ where: { oxQuizSetId: set.id } });
    console.log(
      `target: [${t.category}] "${t.title}" id=${set.id}  questions=${questionCount}  attempts=${attemptCount}`
    );

    if (attemptCount > 0) {
      const del = await prisma.quizAttempt.deleteMany({ where: { oxQuizSetId: set.id } });
      console.log(`  deleted ${del.count} attempts (cascades OxAnswer)`);
    }

    await prisma.oxQuizSet.delete({ where: { id: set.id } });
    console.log(`  DELETED set + ${questionCount} questions (cascade)`);
  }

  // Final state
  const remaining = await prisma.oxQuizSet.findMany({
    include: { category: true, _count: { select: { questions: true } } },
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }],
  });
  console.log(`---\nremaining OX sets: ${remaining.length}`);
  for (const s of remaining) {
    console.log(`  [${s.category.name}] "${s.title}" — ${s._count.questions} q`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
