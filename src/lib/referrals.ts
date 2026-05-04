import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export const REFERRAL_EVENT_PATH = "/referral-event";

interface ReferralUser {
  id: string;
  nickname: string;
  avatar: string | null;
  createdAt: Date;
}

export interface ReferralInvitee {
  id: string;
  nickname: string;
  avatar: string | null;
  joinedAt: Date;
  invitedAt: Date;
}

export function normalizeInviteCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function makeInviteCode(userId: string) {
  return `STADY${normalizeInviteCode(userId).slice(0, 8)}`;
}

export async function ensureReferralTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralInvite" (
      "id" TEXT PRIMARY KEY,
      "inviterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "inviteeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "inviteCode" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ReferralInvite_invitee_key"
    ON "ReferralInvite" ("inviteeId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReferralInvite_inviter_idx"
    ON "ReferralInvite" ("inviterId")
  `);
}

export async function registerReferralInvite(inviteeId: string, rawInviteCode: unknown) {
  if (typeof rawInviteCode !== "string") return { applied: false };

  const inviteCode = normalizeInviteCode(rawInviteCode);
  if (!inviteCode) return { applied: false };

  await ensureReferralTable();
  const users = await prisma.user.findMany({
    select: { id: true, nickname: true, avatar: true, createdAt: true },
  });
  const inviter = users.find((user) => makeInviteCode(user.id) === inviteCode);

  if (!inviter || inviter.id === inviteeId) {
    return { applied: false, error: "초대코드가 올바르지 않습니다." };
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ReferralInvite" ("id", "inviterId", "inviteeId", "inviteCode")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("inviteeId") DO NOTHING
    `,
    randomUUID(),
    inviter.id,
    inviteeId,
    inviteCode
  );

  return { applied: true };
}

export interface ReferralPair {
  id: string;
  invitedAt: Date;
  inviterId: string;
  inviterNickname: string;
  inviterAvatar: string | null;
  inviteeId: string;
  inviteeNickname: string;
  inviteeAvatar: string | null;
  inviteCode: string;
}

export async function getAllReferrals(): Promise<ReferralPair[]> {
  await ensureReferralTable();
  return prisma.$queryRawUnsafe<ReferralPair[]>(
    `
      SELECT
        r."id",
        r."createdAt" AS "invitedAt",
        r."inviteCode",
        inviter."id"       AS "inviterId",
        inviter."nickname" AS "inviterNickname",
        inviter."avatar"   AS "inviterAvatar",
        invitee."id"       AS "inviteeId",
        invitee."nickname" AS "inviteeNickname",
        invitee."avatar"   AS "inviteeAvatar"
      FROM "ReferralInvite" r
      JOIN "User" inviter ON inviter."id" = r."inviterId"
      JOIN "User" invitee ON invitee."id" = r."inviteeId"
      ORDER BY r."createdAt" DESC
    `
  );
}

export async function getReferralSummary(userId: string) {
  await ensureReferralTable();

  const invitees = await prisma.$queryRawUnsafe<(ReferralUser & { invitedAt: Date })[]>(
    `
      SELECT u."id", u."nickname", u."avatar", u."createdAt", r."createdAt" AS "invitedAt"
      FROM "ReferralInvite" r
      JOIN "User" u ON u."id" = r."inviteeId"
      WHERE r."inviterId" = $1
      ORDER BY r."createdAt" DESC
    `,
    userId
  );

  return {
    inviteCode: makeInviteCode(userId),
    invitedCount: invitees.length,
    canClaimThreeMonths: invitees.length >= 5,
    canClaimSixMonths: invitees.length >= 10,
    invitees: invitees.map<ReferralInvitee>((invitee) => ({
      id: invitee.id,
      nickname: invitee.nickname,
      avatar: invitee.avatar,
      joinedAt: invitee.createdAt,
      invitedAt: invitee.invitedAt,
    })),
  };
}
