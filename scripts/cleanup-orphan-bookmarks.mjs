// Delete orphaned bookmarks: rows whose referenced quiz/question no longer
// exists (they already render hidden in the UI). Backs up the rows to
// backups/ before deleting. Safe by default (dry-run).
//   Dry-run: node --env-file=.env.local scripts/cleanup-orphan-bookmarks.mjs
//   Apply:   APPLY=1 node --env-file=.env.local scripts/cleanup-orphan-bookmarks.mjs
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
const prisma = new PrismaClient();

const APPLY = process.env.APPLY === "1";

// A bookmark is orphaned if any non-null reference points to a missing row.
const ORPHAN_WHERE = `
  ("oxQuizSetId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OxQuizSet" s WHERE s."id" = b."oxQuizSetId"))
  OR ("oxQuestionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OxQuestion" x WHERE x."id" = b."oxQuestionId"))
  OR ("vocabQuizSetId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "VocabQuizSet" s WHERE s."id" = b."vocabQuizSetId"))
  OR ("vocabQuestionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "VocabQuestion" x WHERE x."id" = b."vocabQuestionId"))
  OR ("workbookId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Workbook" w WHERE w."id" = b."workbookId"))
  OR ("problemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Problem" p WHERE p."id" = b."problemId"))
`;

async function main() {
  const orphans = await prisma.$queryRawUnsafe(
    `SELECT b.* FROM "Bookmark" b WHERE ${ORPHAN_WHERE}`
  );
  console.log(`Orphaned bookmark rows: ${orphans.length}`);
  console.log(`Mode: ${APPLY ? "APPLY (deleting)" : "DRY-RUN (no changes)"}`);

  if (!APPLY) {
    console.log("Re-run with APPLY=1 to back up and delete.");
    return;
  }

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `backups/orphan-bookmarks-${stamp}.json`;
  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), count: orphans.length, rows: orphans }, null, 2));
  console.log(`Backup written: ${file}`);

  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM "Bookmark" b WHERE ${ORPHAN_WHERE}`
  );
  const remaining = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Bookmark" b WHERE ${ORPHAN_WHERE}`
  );
  console.log(`Deleted: ${deleted}. Remaining orphans: ${remaining[0].n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
