// Snapshot everything the OX re-split migration will touch, so it can be
// reconstructed if needed. Writes a JSON file under ./backups/ (NOT committed —
// contains userIds). Covers 생활과윤리 + 윤리와사상.
//
//   node scripts/backup-ox-resplit.mjs
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

process.env.POSTGRES_PRISMA_URL ||= readFileSync(".env", "utf8").match(
  /^POSTGRES_PRISMA_URL="?([^"\n]+)"?/m
)[1];
const prisma = new PrismaClient();

const CATEGORY_NAMES = ["생활과윤리", "윤리와사상"];

async function main() {
  const snapshot = { takenAt: new Date().toISOString(), note: "Pre re-split snapshot", categories: [] };

  for (const name of CATEGORY_NAMES) {
    const category = await prisma.category.findFirst({ where: { name } });
    if (!category) throw new Error(`Category not found: ${name}`);

    const sets = await prisma.oxQuizSet.findMany({ where: { categoryId: category.id } });
    const setIds = sets.map((s) => s.id);

    // questions: keep full rows so text/answer/explanation can be restored too
    const questions = await prisma.oxQuestion.findMany({
      where: { oxQuizSetId: { in: setIds } },
      orderBy: [{ oxQuizSetId: "asc" }, { order: "asc" }],
    });

    // bookmarks / attempts: only the fields needed to reverse the re-pointing
    // (NOT memo/drawing — those are huge data-URLs and never change here)
    const bookmarks = await prisma.bookmark.findMany({
      where: { oxQuizSetId: { in: setIds } },
      select: { id: true, userId: true, quizType: true, oxQuestionId: true, oxQuizSetId: true },
    });
    const attempts = await prisma.quizAttempt.findMany({
      where: { oxQuizSetId: { in: setIds } },
      select: { id: true, userId: true, quizType: true, oxQuizSetId: true },
    });

    snapshot.categories.push({
      category,
      setCount: sets.length,
      sets,
      questionCount: questions.length,
      questions,
      bookmarkCount: bookmarks.length,
      bookmarks,
      attemptCount: attempts.length,
      attempts,
    });
    console.log(
      `[${name}] sets=${sets.length} questions=${questions.length} bookmarks=${bookmarks.length} attempts=${attempts.length}`
    );
  }

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `backups/ox-resplit-${stamp}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`\nBackup written: ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
