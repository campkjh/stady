// READ-ONLY diagnostic: detect Apple Sign-In duplicate accounts.
// Apple stores `password = "apple_<sub>"` for BOTH the real-email account and
// the later `apple_<sub>@stady.app` fallback account, so grouping by password
// (where it starts with "apple_") reveals the same Apple user split across rows.
// Run: node --env-file=.env.local scripts/diagnose-apple-dupes.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const totalUsers = await prisma.user.count();
  const fallbackAccounts = await prisma.user.count({
    where: { email: { startsWith: "apple_", endsWith: "@stady.app" } },
  });
  const relayAccounts = await prisma.user.count({
    where: { email: { contains: "privaterelay.appleid.com" } },
  });
  const appleAccounts = await prisma.user.count({
    where: { password: { startsWith: "apple_" } },
  });

  const dupes = await prisma.$queryRawUnsafe(`
    SELECT
      u."password",
      COUNT(*)::int AS cnt,
      json_agg(json_build_object(
        'id', u."id",
        'email', u."email",
        'createdAt', u."createdAt",
        'bookmarks', (SELECT COUNT(*)::int FROM "Bookmark" b WHERE b."userId" = u."id")
      ) ORDER BY u."createdAt" ASC) AS accounts
    FROM "User" u
    WHERE u."password" LIKE 'apple_%'
    GROUP BY u."password"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  const affectedExtraAccounts = dupes.reduce((sum, g) => sum + (g.cnt - 1), 0);
  const bookmarksOnDupes = dupes.reduce(
    (sum, g) => sum + g.accounts.reduce((s, a) => s + a.bookmarks, 0),
    0
  );

  console.log("===== Apple duplicate-account diagnosis (READ ONLY) =====");
  console.log({
    totalUsers,
    appleAccounts,
    fallbackAccounts,
    relayAccounts,
    duplicateAppleGroups: dupes.length,
    affectedExtraAccounts,
    bookmarksHeldOnDuplicatedGroups: bookmarksOnDupes,
  });
  console.log("\n--- duplicate groups (most-split first) ---");
  for (const g of dupes.slice(0, 30)) {
    console.log(`\npassword=${g.password}  (${g.cnt} accounts)`);
    for (const a of g.accounts) {
      console.log(
        `   ${a.email}   bookmarks=${a.bookmarks}   created=${new Date(a.createdAt).toISOString().slice(0, 10)}   id=${a.id}`
      );
    }
  }
  if (dupes.length > 30) console.log(`\n... and ${dupes.length - 30} more groups`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
