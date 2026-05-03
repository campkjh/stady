import { prisma } from "@/lib/prisma";

export async function ensureUserStatusMessageColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "statusMessage" TEXT
  `);
}
