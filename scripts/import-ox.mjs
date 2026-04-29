import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "ox-import-data.json");

const args = process.argv.slice(2);
const categoryName = args.find((a) => !a.startsWith("--")) ?? "생활과윤리";
const force = args.includes("--force");
const difficulty = (args.find((a) => a.startsWith("--difficulty="))?.split("=")[1]) ?? "보통";

const prisma = new PrismaClient();

async function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const order = raw.order;
  const groups = raw.groups;

  const category = await prisma.category.findFirst({ where: { name: categoryName } });
  if (!category) {
    const all = await prisma.category.findMany({ select: { name: true } });
    throw new Error(
      `Category not found: "${categoryName}". Available: ${all.map((c) => c.name).join(", ")}`
    );
  }

  console.log(`category: ${category.name} (${category.id})`);
  console.log(`difficulty: ${difficulty}`);
  console.log(`force: ${force}`);
  console.log("---");

  let createdSets = 0;
  let createdQuestions = 0;
  let skippedSets = 0;

  for (const title of order) {
    const questions = groups[title];

    const existing = await prisma.oxQuizSet.findFirst({
      where: { title, categoryId: category.id },
    });

    if (existing && !force) {
      console.log(`SKIP "${title}" (already exists, ${existing.totalQuestions} q). Use --force to replace.`);
      skippedSets++;
      continue;
    }

    if (existing && force) {
      console.log(`REPLACE "${title}" — deleting existing set ${existing.id}`);
      await prisma.oxQuizSet.delete({ where: { id: existing.id } });
    }

    const set = await prisma.oxQuizSet.create({
      data: {
        title,
        categoryId: category.id,
        difficulty,
        totalQuestions: questions.length,
      },
    });

    await prisma.oxQuestion.createMany({
      data: questions.map((q, i) => ({
        oxQuizSetId: set.id,
        order: i + 1,
        section: q.s ?? null,
        question: q.q,
        answer: q.a === "O",
        explanation: q.e || null,
      })),
    });

    console.log(`CREATED "${title}" (${questions.length} q) → ${set.id}`);
    createdSets++;
    createdQuestions += questions.length;
  }

  console.log("---");
  console.log(`done. sets created: ${createdSets}, questions created: ${createdQuestions}, sets skipped: ${skippedSets}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
