import { PrismaClient } from "@prisma/client";
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
  const cat = await prisma.category.findFirst({ where: { name: "생활과윤리" } });
  console.log(`category: ${cat?.name} (${cat?.id})`);
  let totalQ = 0;
  for (const title of TITLES) {
    const set = await prisma.oxQuizSet.findFirst({
      where: { title, categoryId: cat.id },
      include: { _count: { select: { questions: true } } },
    });
    if (!set) {
      console.log(`MISSING: ${title}`);
      continue;
    }
    const sample = await prisma.oxQuestion.findFirst({
      where: { oxQuizSetId: set.id },
      orderBy: { order: "asc" },
    });
    console.log(
      `${title}: totalQuestions=${set.totalQuestions}, actual=${set._count.questions}, first="${sample?.question?.slice(0, 30)}..." ans=${sample?.answer ? "O" : "X"}`
    );
    totalQ += set._count.questions;
  }
  console.log(`---\ntotal questions across 8 sets: ${totalQ}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
