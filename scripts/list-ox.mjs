import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const sets = await prisma.oxQuizSet.findMany({
    include: { category: true, _count: { select: { questions: true } } },
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }],
  });
  console.log(`total OX sets: ${sets.length}`);
  for (const s of sets) {
    console.log(`  [${s.category.name}] "${s.title}"  id=${s.id}  questions=${s._count.questions}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
