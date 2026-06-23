// Re-split each category's single consolidated OX set back into one set per
// 단원 (the `section` field on each question). Mirrors / reverses
// merge-ox-life-ethics.mjs. Question rows KEEP their ids, so the ~54k
// question-level bookmarks (oxQuestionId) survive automatically; we only
// re-point their denormalized oxQuizSetId. Quiz attempts are re-pointed to the
// 단원 they mostly answered. The now-empty consolidated set is deleted.
//
// Safe by default (dry-run). To actually write:
//   APPLY=1 node scripts/resplit-ox-by-section.mjs
// Dry-run preview:
//   node scripts/resplit-ox-by-section.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

process.env.POSTGRES_PRISMA_URL ||= readFileSync(".env", "utf8").match(
  /^POSTGRES_PRISMA_URL="?([^"\n]+)"?/m
)[1];
const prisma = new PrismaClient();

const CATEGORY_NAMES = ["생활과윤리", "윤리와사상"];
const APPLY = process.env.APPLY === "1";

async function resplitCategory(name, baseMs) {
  const category = await prisma.category.findFirst({ where: { name } });
  if (!category) throw new Error(`Category not found: ${name}`);

  const sets = await prisma.oxQuizSet.findMany({ where: { categoryId: category.id } });
  if (sets.length === 0) {
    console.log(`[${name}] no sets — skip.`);
    return;
  }
  if (sets.length > 1) {
    console.log(`[${name}] already has ${sets.length} sets (not a single consolidated set) — skip to avoid clobbering.`);
    return;
  }
  const consolidated = sets[0];

  // Section breakdown, preserving curriculum order (= first appearance by order).
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "section" AS section, count(*)::int AS c, min("order") AS firstorder
       FROM "OxQuestion" WHERE "oxQuizSetId" = $1
      GROUP BY "section" ORDER BY min("order") ASC`,
    consolidated.id
  );
  const sections = rows.filter((r) => r.section != null && r.section !== "");
  const nullCount = rows.filter((r) => r.section == null || r.section === "").reduce((s, r) => s + r.c, 0);

  console.log(`\n===== [${name}] re-split plan =====`);
  console.log(`Consolidated set "${consolidated.title}" (${consolidated.totalQuestions} questions) -> ${sections.length} 단원 sets:`);
  for (const s of sections) console.log(`   "${s.section}"  ${s.c} questions`);
  if (nullCount > 0) console.log(`   ⚠️ ${nullCount} questions have NO section — they will STAY in "${consolidated.title}" (kept as a set).`);
  if (sections.length <= 1 && nullCount === 0) {
    console.log(`   Only one section — nothing to split. Skip.`);
    return;
  }

  if (!APPLY) return;

  await prisma.$transaction(
    async (tx) => {
      // 1) Create one set per section (distinct, increasing createdAt so the
      //    UI's `orderBy createdAt asc` shows them in curriculum order) and move
      //    that section's questions into it, keeping question ids.
      for (const [i, s] of sections.entries()) {
        const newSet = await tx.oxQuizSet.create({
          data: {
            title: s.section,
            thumbnail: consolidated.thumbnail,
            categoryId: category.id,
            difficulty: consolidated.difficulty,
            totalQuestions: s.c,
            createdAt: new Date(baseMs + i * 1000),
          },
          select: { id: true },
        });
        await tx.$executeRawUnsafe(
          `
          UPDATE "OxQuestion" q
          SET "oxQuizSetId" = $1,
              "order" = sub.rn
          FROM (
            SELECT "id", ROW_NUMBER() OVER (ORDER BY "order" ASC, "id" ASC) AS rn
            FROM "OxQuestion"
            WHERE "oxQuizSetId" = $2 AND "section" = $3
          ) sub
          WHERE q."id" = sub."id"
          `,
          newSet.id,
          consolidated.id,
          s.section
        );
      }

      // 2) Re-point bookmarks: each bookmark pointing at the consolidated set
      //    follows its question to the question's new set.
      const bm = await tx.$executeRawUnsafe(
        `
        UPDATE "Bookmark" b
        SET "oxQuizSetId" = q."oxQuizSetId"
        FROM "OxQuestion" q
        WHERE b."oxQuestionId" = q."id" AND b."oxQuizSetId" = $1
        `,
        consolidated.id
      );

      // 3) Re-point quiz attempts to the 단원 they mostly answered.
      const at = await tx.$executeRawUnsafe(
        `
        WITH ans AS (
          SELECT a."attemptId" AS aid, q."oxQuizSetId" AS newset, COUNT(*) AS c
          FROM "OxAnswer" a
          JOIN "OxQuestion" q ON q."id" = a."questionId"
          JOIN "QuizAttempt" t ON t."id" = a."attemptId"
          WHERE t."oxQuizSetId" = $1
          GROUP BY a."attemptId", q."oxQuizSetId"
        ),
        ranked AS (
          SELECT aid, newset,
                 ROW_NUMBER() OVER (PARTITION BY aid ORDER BY c DESC, newset ASC) AS rn
          FROM ans
        )
        UPDATE "QuizAttempt" t
        SET "oxQuizSetId" = r.newset
        FROM ranked r
        WHERE t."id" = r.aid AND r.rn = 1
        `,
        consolidated.id
      );

      // 4) Handle leftovers (questions with no section stay; bookmarks/attempts
      //    that still point at the consolidated set).
      const remainingQ = await tx.oxQuestion.count({ where: { oxQuizSetId: consolidated.id } });
      if (remainingQ === 0) {
        // No questions left -> the consolidated set is now empty. Null any
        // stragglers that still reference it, then delete it.
        await tx.$executeRawUnsafe(`UPDATE "Bookmark" SET "oxQuizSetId" = NULL WHERE "oxQuizSetId" = $1`, consolidated.id);
        await tx.$executeRawUnsafe(`UPDATE "QuizAttempt" SET "oxQuizSetId" = NULL WHERE "oxQuizSetId" = $1`, consolidated.id);
        await tx.oxQuizSet.delete({ where: { id: consolidated.id } });
        console.log(`[${name}] applied: bookmarksRepointed=${bm}, attemptsRepointed=${at}, newSets=${sections.length}, consolidatedDeleted=yes`);
      } else {
        // Some questions had no section -> keep the consolidated set holding them.
        await tx.oxQuizSet.update({ where: { id: consolidated.id }, data: { totalQuestions: remainingQ } });
        console.log(`[${name}] applied: bookmarksRepointed=${bm}, attemptsRepointed=${at}, newSets=${sections.length}, consolidatedKept(${remainingQ} sectionless q)`);
      }
    },
    { timeout: 120000, maxWait: 120000 }
  );
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no changes)"}`);
  const baseMs = Date.now();
  for (const name of CATEGORY_NAMES) await resplitCategory(name, baseMs);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with APPLY=1 to execute.");
    return;
  }

  // Post-check
  console.log("\n===== post-check =====");
  for (const name of CATEGORY_NAMES) {
    const category = await prisma.category.findFirst({ where: { name } });
    const sets = await prisma.oxQuizSet.findMany({
      where: { categoryId: category.id },
      orderBy: { createdAt: "asc" },
      select: { title: true, totalQuestions: true },
    });
    console.log(`[${name}] ${sets.length} sets:`);
    for (const s of sets) console.log(`   "${s.title}" (${s.totalQuestions})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
