// Merge "워드마스터 수능 다의어분리" (SOURCE) into "수능 빈출 영단어" (TARGET).
// Source questions are APPENDED after target's last word; bookmarks and quiz
// attempts that referenced the source SET are re-pointed to the target, so
// nothing the user saved disappears. Question rows keep their ids, so
// question-level bookmarks (vocabQuestionId) stay valid automatically.
//
// Safe by default (dry-run). To actually write:
//   APPLY=1 node --env-file=.env.local scripts/merge-vocab-sets.mjs
// Dry-run preview:
//   node --env-file=.env.local scripts/merge-vocab-sets.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TARGET_ID = "fa888eeb-b12d-465a-b1be-45d82e162833"; // 수능 빈출 영단어
const SOURCE_ID = "46558ffe-b721-466c-8726-c1330d62ef7c"; // 워드마스터 수능 다의어분리
const APPLY = process.env.APPLY === "1";

async function main() {
  const target = await prisma.vocabQuizSet.findUnique({ where: { id: TARGET_ID } });
  const source = await prisma.vocabQuizSet.findUnique({ where: { id: SOURCE_ID } });
  if (!target) throw new Error(`TARGET set not found: ${TARGET_ID}`);
  if (!source) throw new Error(`SOURCE set not found: ${SOURCE_ID}`);

  const targetCount = await prisma.vocabQuestion.count({ where: { vocabQuizSetId: TARGET_ID } });
  const sourceCount = await prisma.vocabQuestion.count({ where: { vocabQuizSetId: SOURCE_ID } });
  const maxAgg = await prisma.vocabQuestion.aggregate({
    where: { vocabQuizSetId: TARGET_ID },
    _max: { order: true },
  });
  const base = maxAgg._max.order ?? 0;
  const srcBookmarks = await prisma.bookmark.count({ where: { vocabQuizSetId: SOURCE_ID } });
  const srcAttempts = await prisma.quizAttempt.count({ where: { vocabQuizSetId: SOURCE_ID } });

  console.log("===== Vocab merge plan =====");
  console.log(`TARGET "${target.title}"  (${targetCount} questions, maxOrder=${base})`);
  console.log(`SOURCE "${source.title}"  (${sourceCount} questions, ${srcBookmarks} set-bookmarks, ${srcAttempts} attempts)`);
  console.log(`After merge: TARGET will have ${targetCount + sourceCount} questions`);
  console.log(`Source questions get order ${base + 1}..${base + sourceCount}, then SOURCE set is deleted.`);
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no changes)"}`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with APPLY=1 to execute.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1) Move source questions to target, appending after target's max order.
    const moved = await tx.$executeRawUnsafe(
      `
      UPDATE "VocabQuestion" q
      SET "vocabQuizSetId" = $1,
          "order" = $2 + sub.rn
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "order" ASC, "id" ASC) AS rn
        FROM "VocabQuestion"
        WHERE "vocabQuizSetId" = $3
      ) sub
      WHERE q."id" = sub."id"
      `,
      TARGET_ID,
      base,
      SOURCE_ID
    );

    // 2) Re-point bookmarks that referenced the SOURCE set.
    const bm = await tx.bookmark.updateMany({
      where: { vocabQuizSetId: SOURCE_ID },
      data: { vocabQuizSetId: TARGET_ID },
    });

    // 3) Re-point quiz attempts that referenced the SOURCE set.
    const at = await tx.quizAttempt.updateMany({
      where: { vocabQuizSetId: SOURCE_ID },
      data: { vocabQuizSetId: TARGET_ID },
    });

    // 4) Recompute target totalQuestions.
    const newCount = await tx.vocabQuestion.count({ where: { vocabQuizSetId: TARGET_ID } });
    await tx.vocabQuizSet.update({
      where: { id: TARGET_ID },
      data: { totalQuestions: newCount },
    });

    // 5) Delete the now-empty source set.
    const remaining = await tx.vocabQuestion.count({ where: { vocabQuizSetId: SOURCE_ID } });
    if (remaining !== 0) throw new Error(`SOURCE still has ${remaining} questions; aborting before delete.`);
    await tx.vocabQuizSet.delete({ where: { id: SOURCE_ID } });

    console.log(
      `\nApplied: movedQuestions=${moved}, repointedBookmarks=${bm.count}, repointedAttempts=${at.count}, targetTotalQuestions=${newCount}`
    );
  });

  // Post-check
  const finalCount = await prisma.vocabQuestion.count({ where: { vocabQuizSetId: TARGET_ID } });
  const sourceGone = (await prisma.vocabQuizSet.findUnique({ where: { id: SOURCE_ID } })) === null;
  console.log(`\nDone. TARGET now has ${finalCount} questions. SOURCE deleted: ${sourceGone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
