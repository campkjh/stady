// Snapshot everything the vocab merge will touch, so it can be reconstructed.
// Writes a JSON file under ./backups/ (NOT committed — contains userIds).
// Run: node --env-file=.env.local scripts/backup-vocab-merge.mjs
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
const prisma = new PrismaClient();

const TARGET_ID = "fa888eeb-b12d-465a-b1be-45d82e162833"; // 수능 빈출 영단어
const SOURCE_ID = "46558ffe-b721-466c-8726-c1330d62ef7c"; // 워드마스터 수능 다의어분리

async function main() {
  const sourceSet = await prisma.vocabQuizSet.findUnique({ where: { id: SOURCE_ID } });
  const targetSet = await prisma.vocabQuizSet.findUnique({ where: { id: TARGET_ID } });
  const sourceQuestions = await prisma.vocabQuestion.findMany({
    where: { vocabQuizSetId: SOURCE_ID },
    orderBy: { order: "asc" },
  });
  const affectedBookmarks = await prisma.bookmark.findMany({ where: { vocabQuizSetId: SOURCE_ID } });
  const affectedAttempts = await prisma.quizAttempt.findMany({ where: { vocabQuizSetId: SOURCE_ID } });

  const snapshot = {
    takenAt: new Date().toISOString(),
    note: "Pre-merge snapshot: 워드마스터 수능 다의어분리 -> 수능 빈출 영단어",
    targetSet,
    sourceSet,
    sourceQuestionCount: sourceQuestions.length,
    sourceQuestions,
    affectedBookmarkCount: affectedBookmarks.length,
    affectedBookmarks,
    affectedAttemptCount: affectedAttempts.length,
    affectedAttempts,
  };

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `backups/vocab-merge-${stamp}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(
    `Backup written: ${file}\n  sourceQuestions=${sourceQuestions.length}  bookmarks=${affectedBookmarks.length}  attempts=${affectedAttempts.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
