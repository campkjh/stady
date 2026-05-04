import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const UPDATES = [
  { name: "생활과윤리", icon: "/icons/category-생활과윤리.png" },
  { name: "사회문화", icon: "/icons/category-사회문화.png" },
  { name: "윤리와사상", icon: "/icons/category-윤리와사상.png" },
];

async function main() {
  for (const u of UPDATES) {
    const before = await prisma.category.findFirst({ where: { name: u.name } });
    if (!before) {
      console.log(`SKIP ${u.name}: not found`);
      continue;
    }
    const after = await prisma.category.update({
      where: { id: before.id },
      data: { icon: u.icon },
    });
    console.log(`UPDATED ${u.name}: ${before.icon} → ${after.icon}`);
  }
  const all = await prisma.category.findMany({
    select: { name: true, icon: true, order: true },
    orderBy: { order: "asc" },
  });
  console.log("---\nAll categories:");
  for (const c of all) {
    console.log(`  [${c.order}] ${c.name}  →  ${c.icon}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
