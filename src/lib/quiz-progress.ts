import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface QuizProgressRow {
  id: string;
  userId: string;
  quizKey: string;
  answersJson: string;
  currentIndex: number;
  updatedAt: Date;
}

export async function ensureQuizProgressTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuizProgress" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "quizKey" TEXT NOT NULL,
      "answersJson" TEXT NOT NULL,
      "currentIndex" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "QuizProgress_userId_quizKey_key"
    ON "QuizProgress" ("userId", "quizKey")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "QuizProgress_userId_idx"
    ON "QuizProgress" ("userId")
  `);
}

export async function getQuizProgress(userId: string, quizKey: string): Promise<QuizProgressRow | null> {
  await ensureQuizProgressTable();
  const rows = await prisma.$queryRawUnsafe<QuizProgressRow[]>(
    `SELECT "id", "userId", "quizKey", "answersJson", "currentIndex", "updatedAt"
       FROM "QuizProgress"
      WHERE "userId" = $1 AND "quizKey" = $2
      LIMIT 1`,
    userId,
    quizKey
  );
  return rows[0] ?? null;
}

export async function upsertQuizProgress(
  userId: string,
  quizKey: string,
  answersJson: string,
  currentIndex: number
) {
  await ensureQuizProgressTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "QuizProgress" ("id", "userId", "quizKey", "answersJson", "currentIndex", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "quizKey")
      DO UPDATE SET
        "answersJson" = EXCLUDED."answersJson",
        "currentIndex" = EXCLUDED."currentIndex",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    randomUUID(),
    userId,
    quizKey,
    answersJson,
    currentIndex
  );
}

export async function deleteQuizProgress(userId: string, quizKey: string) {
  await ensureQuizProgressTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "QuizProgress" WHERE "userId" = $1 AND "quizKey" = $2`,
    userId,
    quizKey
  );
}
