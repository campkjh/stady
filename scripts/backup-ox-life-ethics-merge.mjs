// Snapshot everything the 생활과윤리 OX merge will touch, so it can be reconstructed.
// Writes a JSON file under ./backups/ (NOT committed — contains userIds).
// Run: node --env-file=.env.local scripts/backup-ox-life-ethics-merge.mjs
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
const prisma = new PrismaClient();

const CATEGORY_NAME = "생활과윤리";

async function main() {
  const category = await prisma.category.findFirst({ where: { name: CATEGORY_NAME } });
  if (!category) throw new Error(`Category not found: ${CATEGORY_NAME}`);

  const sets = await prisma.oxQuizSet.findMany({
    where: { categoryId: category.id },
    orderBy: { createdAt: "asc" },
  });
  const setIds = sets.map((s) => s.id);

  const questions = await prisma.oxQuestion.findMany({
    where: { oxQuizSetId: { in: setIds } },
    orderBy: [{ oxQuizSetId: "asc" }, { order: "asc" }],
  });
  const affectedBookmarks = await prisma.bookmark.findMany({
    where: { oxQuizSetId: { in: setIds } },
  });
  const affectedAttempts = await prisma.quizAttempt.findMany({
    where: { oxQuizSetId: { in: setIds } },
  });

  const snapshot = {
    takenAt: new Date().toISOString(),
    note: "Pre-merge snapshot: 생활과윤리 OX 16 sets -> single set",
    category,
    setCount: sets.length,
    sets,
    questionCount: questions.length,
    questions,
    affectedBookmarkCount: affectedBookmarks.length,
    affectedBookmarks,
    affectedAttemptCount: affectedAttempts.length,
    affectedAttempts,
  };

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `backups/ox-life-ethics-merge-${stamp}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(
    `Backup written: ${file}\n  sets=${sets.length}  questions=${questions.length}  bookmarks=${affectedBookmarks.length}  attempts=${affectedAttempts.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
