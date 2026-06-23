// Merge all 생활과윤리 OX sets into a SINGLE set so the quiz plays as one
// continuous test with no per-단원 enter/exit. The existing "생활과윤리 OX정리"
// set is the TARGET; every other 생활과윤리 set (윤리학의 분류 … 해외 원조) is a
// SOURCE whose questions are APPENDED after the target's last question, with the
// moved questions' `section` set to their original set title (so the 단원 still
// shows as a group header inside the single quiz drawer).
//
// Bookmarks and quiz attempts that referenced a SOURCE set are re-pointed to the
// TARGET, so nothing the user saved disappears. Question rows keep their ids, so
// question-level bookmarks (oxQuestionId) stay valid automatically.
//
// Safe by default (dry-run). To actually write:
//   APPLY=1 node --env-file=.env.local scripts/merge-ox-life-ethics.mjs
// Dry-run preview:
//   node --env-file=.env.local scripts/merge-ox-life-ethics.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const prisma = new PrismaClient();

const CATEGORY_NAME = "생활과윤리";
const TARGET_TITLE = "생활과윤리 OX정리"; // existing consolidated set is the anchor
const APPLY = process.env.APPLY === "1";

// Preferred 단원 ordering for the appended sets (matches the original import order).
const importData = JSON.parse(
  readFileSync(new URL("./ox-import-data.json", import.meta.url), "utf-8")
);
const UNIT_ORDER = Array.isArray(importData.order) ? importData.order : [];

function unitRank(title) {
  const i = UNIT_ORDER.indexOf(title);
  return i === -1 ? UNIT_ORDER.length + 1 : i;
}

async function main() {
  const category = await prisma.category.findFirst({ where: { name: CATEGORY_NAME } });
  if (!category) throw new Error(`Category not found: ${CATEGORY_NAME}`);

  const sets = await prisma.oxQuizSet.findMany({ where: { categoryId: category.id } });
  const target = sets.find((s) => s.title === TARGET_TITLE);
  if (!target) throw new Error(`TARGET set "${TARGET_TITLE}" not found in ${CATEGORY_NAME}`);

  // Everything else in the category is a source, ordered by 단원 import order.
  const sources = sets
    .filter((s) => s.id !== target.id)
    .sort((a, b) => unitRank(a.title) - unitRank(b.title));

  if (sources.length === 0) {
    console.log("Nothing to merge — category already has a single set. Done.");
    return;
  }

  const targetCount = await prisma.oxQuestion.count({ where: { oxQuizSetId: target.id } });
  const maxAgg = await prisma.oxQuestion.aggregate({
    where: { oxQuizSetId: target.id },
    _max: { order: true },
  });
  let base = maxAgg._max.order ?? 0;

  console.log("===== 생활과윤리 OX merge plan =====");
  console.log(`TARGET "${target.title}"  (${targetCount} questions, maxOrder=${base})`);
  console.log(`SOURCES (${sources.length}) — appended in this order:`);
  let plannedBase = base;
  let totalSrc = 0;
  for (const s of sources) {
    const c = await prisma.oxQuestion.count({ where: { oxQuizSetId: s.id } });
    const bm = await prisma.bookmark.count({ where: { oxQuizSetId: s.id } });
    const at = await prisma.quizAttempt.count({ where: { oxQuizSetId: s.id } });
    console.log(
      `   "${s.title}"  ${c} q -> order ${plannedBase + 1}..${plannedBase + c}  (section="${s.title}", ${bm} set-bookmarks, ${at} attempts)`
    );
    plannedBase += c;
    totalSrc += c;
  }
  console.log(`After merge: TARGET will have ${targetCount + totalSrc} questions; ${sources.length} source sets deleted.`);
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no changes)"}`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with APPLY=1 to execute.");
    return;
  }

  const sourceIds = sources.map((s) => s.id);

  await prisma.$transaction(
    async (tx) => {
      // 1) Move each source's questions to the target, appending after the
      //    running max order, and relabel section = original 단원 title.
      for (const s of sources) {
        const moved = await tx.$executeRawUnsafe(
          `
          UPDATE "OxQuestion" q
          SET "oxQuizSetId" = $1,
              "section" = $2,
              "order" = $3 + sub.rn
          FROM (
            SELECT "id", ROW_NUMBER() OVER (ORDER BY "order" ASC, "id" ASC) AS rn
            FROM "OxQuestion"
            WHERE "oxQuizSetId" = $4
          ) sub
          WHERE q."id" = sub."id"
          `,
          target.id,
          s.title,
          base,
          s.id
        );
        base += Number(moved);
      }

      // 2) Re-point bookmarks that referenced any SOURCE set.
      const bm = await tx.bookmark.updateMany({
        where: { oxQuizSetId: { in: sourceIds } },
        data: { oxQuizSetId: target.id },
      });

      // 3) Re-point quiz attempts that referenced any SOURCE set.
      const at = await tx.quizAttempt.updateMany({
        where: { oxQuizSetId: { in: sourceIds } },
        data: { oxQuizSetId: target.id },
      });

      // 4) Recompute target totalQuestions.
      const newCount = await tx.oxQuestion.count({ where: { oxQuizSetId: target.id } });
      await tx.oxQuizSet.update({
        where: { id: target.id },
        data: { totalQuestions: newCount },
      });

      // 5) Delete the now-empty source sets.
      const remaining = await tx.oxQuestion.count({ where: { oxQuizSetId: { in: sourceIds } } });
      if (remaining !== 0) throw new Error(`SOURCES still hold ${remaining} questions; aborting before delete.`);
      const del = await tx.oxQuizSet.deleteMany({ where: { id: { in: sourceIds } } });

      console.log(
        `\nApplied: repointedBookmarks=${bm.count}, repointedAttempts=${at.count}, targetTotalQuestions=${newCount}, deletedSets=${del.count}`
      );
    },
    { timeout: 120000, maxWait: 120000 }
  );

  // Post-check
  const finalCount = await prisma.oxQuestion.count({ where: { oxQuizSetId: target.id } });
  const remainingSets = await prisma.oxQuizSet.count({ where: { categoryId: category.id } });
  console.log(`\nDone. TARGET now has ${finalCount} questions. 생활과윤리 set count: ${remainingSets}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
