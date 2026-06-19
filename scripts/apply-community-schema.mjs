// Apply + verify the additive community schema (mirrors ensureCommunityTables).
// Additive & idempotent (ADD COLUMN / CREATE TABLE IF NOT EXISTS) — safe to run
// against prod and coexists with the currently-deployed code.
// Run: node --env-file=.env.local scripts/apply-community-schema.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'normal'`,
  `ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "is_blinded" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "CommunityPostLike" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'heart'`,
  `CREATE TABLE IF NOT EXISTS "CommunityPollOption" (
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "CommunityPollOption_post_idx" ON "CommunityPollOption" ("post_id", "sort_order")`,
  `CREATE TABLE IF NOT EXISTS "CommunityPollVote" (
    "post_id" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
    "option_id" TEXT NOT NULL REFERENCES "CommunityPollOption"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("post_id", "user_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "CommunityPollVote_option_idx" ON "CommunityPollVote" ("option_id")`,
];

async function main() {
  for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE (table_name = 'CommunityPost' AND column_name IN ('type','is_blinded'))
       OR (table_name = 'CommunityPostLike' AND column_name = 'type')
    ORDER BY table_name, column_name
  `);
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('CommunityPollOption','CommunityPollVote')
    ORDER BY table_name
  `);
  console.log("Applied. New columns:", cols);
  console.log("Poll tables:", tables);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
