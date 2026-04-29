import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "ox-import-data.json");

const prisma = new PrismaClient();

async function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const order = raw.order;
  const groups = raw.groups;

  let totalUpdated = 0;
  let totalMismatched = 0;

  for (const title of order) {
    const set = await prisma.oxQuizSet.findFirst({ where: { title } });
    if (!set) {
      console.log(`SKIP "${title}": set not found`);
      continue;
    }

    const expected = groups[title];
    const existing = await prisma.oxQuestion.findMany({
      where: { oxQuizSetId: set.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true, question: true },
    });

    if (existing.length !== expected.length) {
      console.log(`WARN "${title}": expected ${expected.length} questions, found ${existing.length}`);
    }

    let updated = 0;
    let mismatched = 0;
    for (let i = 0; i < expected.length && i < existing.length; i++) {
      const exp = expected[i];
      const cur = existing[i];
      // Sanity: question text should match (helps catch ordering drift)
      if (cur.question.trim() !== exp.q.trim()) {
        mismatched++;
        console.log(`  MISMATCH order=${cur.order}: db="${cur.question.slice(0,30)}..." vs sheet="${exp.q.slice(0,30)}..."`);
        continue;
      }
      await prisma.oxQuestion.update({
        where: { id: cur.id },
        data: { section: exp.s ?? null },
      });
      updated++;
    }
    console.log(`"${title}": updated ${updated}/${expected.length}, mismatched ${mismatched}`);
    totalUpdated += updated;
    totalMismatched += mismatched;
  }
  console.log(`---\ntotal updated: ${totalUpdated}, mismatched: ${totalMismatched}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
