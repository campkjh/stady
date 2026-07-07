// Remove the sub-tags under the "학습"(study) category group, keeping "자유/입시/질문게시판/대학" untouched.
// Mirrors deleteOrDeactivateTag in src/lib/community.ts: tags still linked to posts are
// deactivated (is_active=false, reversible) instead of hard-deleted so existing posts aren't broken.
// Run: node --env-file=.env scripts/delete-study-group-tags.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STUDY_GROUP_SLUG = "study";

async function main() {
  const group = await prisma.$queryRawUnsafe(
    `SELECT "id", "name" FROM "CommunityCategoryGroup" WHERE "slug" = $1`,
    STUDY_GROUP_SLUG
  );
  if (!group[0]) throw new Error("study group not found");
  const groupId = group[0].id;

  const tags = await prisma.$queryRawUnsafe(
    `SELECT "id", "name" FROM "CommunityTag" WHERE "group_id" = $1 ORDER BY "sort_order"`,
    groupId
  );

  for (const tag of tags) {
    const linked = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS "count" FROM "CommunityPostTag" WHERE "tag_id" = $1`,
      tag.id
    );
    if (Number(linked[0]?.count || 0) > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "CommunityTag" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        tag.id
      );
      console.log(`deactivated (in use): ${tag.name}`);
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM "CommunityTag" WHERE "id" = $1`, tag.id);
      console.log(`deleted (unused): ${tag.name}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
