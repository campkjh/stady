import { prisma } from "@/lib/prisma";

const CLEANUP_KEY = "remove-initial-workbook-data-2026-05-03";

export async function ensureInitialWorkbookDataRemoved() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataCleanup" (
      "key" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const done = await prisma.$queryRawUnsafe<{ key: string }[]>(
    `SELECT "key" FROM "DataCleanup" WHERE "key" = $1 LIMIT 1`,
    CLEANUP_KEY
  );
  if (done.length > 0) return;

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`
      DELETE FROM "ProblemAnswer" pa
      USING "Problem" p
      WHERE pa."problemId" = p."id"
    `),
    prisma.$executeRawUnsafe(`
      DELETE FROM "Bookmark"
      WHERE "quizType" = 'workbook' OR "workbookId" IS NOT NULL OR "problemId" IS NOT NULL
    `),
    prisma.$executeRawUnsafe(`DELETE FROM "Review"`),
    prisma.$executeRawUnsafe(`
      DELETE FROM "QuizAttempt"
      WHERE "quizType" = 'workbook' OR "workbookId" IS NOT NULL
    `),
    prisma.$executeRawUnsafe(`DELETE FROM "Problem"`),
    prisma.$executeRawUnsafe(`DELETE FROM "Workbook"`),
  ]);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "DataCleanup" ("key") VALUES ($1) ON CONFLICT ("key") DO NOTHING`,
    CLEANUP_KEY
  );
}
