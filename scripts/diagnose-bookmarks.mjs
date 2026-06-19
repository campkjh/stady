// READ-ONLY diagnostic: find orphaned bookmarks (rows whose referenced quiz
// content no longer exists -> they render blank in the UI = "disappeared").
// Run: node --env-file=.env.local scripts/diagnose-bookmarks.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function q(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  const total = await prisma.bookmark.count();
  const byType = await prisma.$queryRawUnsafe(`
    SELECT "quizType", COUNT(*)::int AS n FROM "Bookmark" GROUP BY "quizType" ORDER BY n DESC
  `);

  // Orphans: reference id is set but the target row is gone.
  const orphanOxSet = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."oxQuizSetId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "OxQuizSet" s WHERE s."id" = b."oxQuizSetId")`);
  const orphanOxQ = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."oxQuestionId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "OxQuestion" x WHERE x."id" = b."oxQuestionId")`);
  const orphanVocabSet = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."vocabQuizSetId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "VocabQuizSet" s WHERE s."id" = b."vocabQuizSetId")`);
  const orphanVocabQ = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."vocabQuestionId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "VocabQuestion" x WHERE x."id" = b."vocabQuestionId")`);
  const orphanWorkbook = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."workbookId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Workbook" w WHERE w."id" = b."workbookId")`);
  const orphanProblem = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."problemId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Problem" p WHERE p."id" = b."problemId")`);

  // Bookmarks with NO target id at all (shouldn't happen, but check).
  const noTarget = await q(`
    SELECT COUNT(*)::int AS n FROM "Bookmark" b
    WHERE b."oxQuizSetId" IS NULL AND b."oxQuestionId" IS NULL
      AND b."vocabQuizSetId" IS NULL AND b."vocabQuestionId" IS NULL
      AND b."workbookId" IS NULL AND b."problemId" IS NULL`);

  console.log("===== Bookmark integrity diagnosis (READ ONLY) =====");
  console.log({ totalBookmarks: total });
  console.log("byType:", byType);
  console.log("orphans:", {
    orphanOxSet,
    orphanOxQuestion: orphanOxQ,
    orphanVocabSet,
    orphanVocabQuestion: orphanVocabQ,
    orphanWorkbook,
    orphanProblem,
    noTargetAtAll: noTarget,
    totalOrphans:
      orphanOxSet + orphanOxQ + orphanVocabSet + orphanVocabQ + orphanWorkbook + orphanProblem,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
