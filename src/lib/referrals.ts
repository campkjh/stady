import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getFreePremiumUntil, grantFreePremiumDays } from "@/lib/premiumGrant";

export const REFERRAL_EVENT_PATH = "/referral-event";
// 친구 1명 초대(가입 성사)마다 초대한 사람에게 주는 무료 프리미엄 일수 (결제 없음).
export const REFERRAL_REWARD_DAYS = 14;
// 초대코드를 '손으로' 입력할 수 있는 기간(가입 후 N일). 초대 링크를 안 타고 가입한 신규 사용자를
// 구제하되, 기존 회원 전체가 서로 코드를 넣어 무료 이용권을 받는 것은 막기 위한 안전장치.
export const REFERRAL_CODE_ENTRY_DAYS = 7;

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

  const inserted = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
      INSERT INTO "ReferralInvite" ("id", "inviterId", "inviteeId", "inviteCode")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("inviteeId") DO NOTHING
      RETURNING "id"
    `,
    randomUUID(),
    inviter.id,
    inviteeId,
    inviteCode
  );

  // 새 초대가 성사됐을 때만(중복 아님) 초대한 사람 + 초대받은 친구 모두에게 2주 무료 프리미엄.
  if (inserted.length > 0) {
    try {
      await grantFreePremiumDays(inviter.id, REFERRAL_REWARD_DAYS, "referral");
      await grantFreePremiumDays(inviteeId, REFERRAL_REWARD_DAYS, "referral_invitee");
    } catch (error) {
      // 보상 지급 실패가 가입 흐름을 막지 않도록 삼킨다 (초대 기록은 이미 남았다).
      console.error("referral reward grant failed:", error);
    }
  }

  return { applied: true, rewarded: inserted.length > 0 };
}

/** 이 계정이 지금 초대코드를 입력할 수 있는지(아직 적용 안 했고, 가입 후 허용 기간 이내). */
export async function getCodeEntryEligibility(userId: string): Promise<{ canEnter: boolean; alreadyInvited: boolean }> {
  await ensureReferralTable();
  const invited = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ReferralInvite" WHERE "inviteeId" = $1 LIMIT 1`,
    userId
  );
  const alreadyInvited = invited.length > 0;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  const withinWindow = me
    ? (Date.now() - new Date(me.createdAt).getTime()) / 86_400_000 <= REFERRAL_CODE_ENTRY_DAYS
    : false;
  return { canEnter: !alreadyInvited && withinWindow, alreadyInvited };
}

/** 사용자가 직접 입력한 초대코드 적용. 실패 사유를 사람이 읽을 수 있게 돌려준다. */
export async function applyReferralCode(userId: string, rawCode: unknown): Promise<{ ok: boolean; error?: string }> {
  const code = normalizeInviteCode(typeof rawCode === "string" ? rawCode : "");
  if (!code) return { ok: false, error: "초대코드를 입력해 주세요." };

  const { alreadyInvited, canEnter } = await getCodeEntryEligibility(userId);
  if (alreadyInvited) return { ok: false, error: "이미 초대코드가 적용된 계정이에요." };
  if (!canEnter) {
    return { ok: false, error: `초대코드는 가입 후 ${REFERRAL_CODE_ENTRY_DAYS}일 이내에만 입력할 수 있어요.` };
  }

  const result = await registerReferralInvite(userId, code);
  if (!result.applied) return { ok: false, error: result.error ?? "초대코드가 올바르지 않습니다." };
  return { ok: true };
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

  const freePremiumUntil = await getFreePremiumUntil(userId);
  const { canEnter, alreadyInvited } = await getCodeEntryEligibility(userId);

  return {
    inviteCode: makeInviteCode(userId),
    canEnterCode: canEnter, // 초대코드 입력창을 띄울지
    alreadyInvited, // 이미 누군가의 초대를 받은 계정인지
    invitedCount: invitees.length,
    rewardDays: REFERRAL_REWARD_DAYS, // 초대 1명당 무료 프리미엄 일수
    freePremiumUntil: freePremiumUntil ? freePremiumUntil.toISOString() : null,
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
