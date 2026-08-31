import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getFreePremiumUntil } from "@/lib/premiumGrant";
import { isAnswerKing } from "@/lib/community";
import type { Platform, PlanId, SubStatus, VerifiedSubscription } from "./types";

// Single source of truth for a user's premium access, granted by store receipts
// (Apple/Google). Raw SQL + CREATE TABLE IF NOT EXISTS, matching the
// community/payments/subscriptions modules (never `prisma db push` — the DB holds
// tables not in schema.prisma).

export interface IapSubscriptionRow {
  id: string;
  user_id: string;
  platform: Platform;
  plan_id: PlanId;
  product_id: string;
  original_id: string;
  latest_transaction_id: string | null;
  status: SubStatus;
  auto_renew: boolean;
  environment: string;
  current_period_end: Date;
  purchased_at: Date | null;
  canceled_at: Date | null;
  raw: unknown;
  created_at: Date;
  updated_at: Date;
}

export async function ensureIapTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IapSubscription" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "platform" TEXT NOT NULL,
      "plan_id" TEXT NOT NULL,
      "product_id" TEXT NOT NULL,
      "original_id" TEXT NOT NULL,
      "latest_transaction_id" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "auto_renew" BOOLEAN NOT NULL DEFAULT true,
      "environment" TEXT NOT NULL DEFAULT 'Production',
      "current_period_end" TIMESTAMP(3) NOT NULL,
      "purchased_at" TIMESTAMP(3),
      "canceled_at" TIMESTAMP(3),
      "raw" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // A store subscription (originalTransactionId / purchaseToken) is unique and
  // renews onto the same row. Webhooks find it by this key (they don't carry our
  // user id), so it must be findable without user_id.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "IapSubscription_platform_original_key"
    ON "IapSubscription" ("platform", "original_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "IapSubscription_user_idx"
    ON "IapSubscription" ("user_id", "current_period_end")
  `);
}

/**
 * Upsert a verified subscription. Called from:
 *  - the verify endpoints (userId known, from the authenticated session)
 *  - store webhooks (userId null → keep the user already attached to the row)
 */
export async function upsertVerifiedSubscription(
  userId: string | null,
  v: VerifiedSubscription
): Promise<IapSubscriptionRow> {
  await ensureIapTables();

  const existing = await prisma.$queryRawUnsafe<IapSubscriptionRow[]>(
    `SELECT * FROM "IapSubscription" WHERE "platform" = $1 AND "original_id" = $2 LIMIT 1`,
    v.platform,
    v.originalId
  );
  const resolvedUser = userId ?? existing[0]?.user_id ?? null;
  if (!resolvedUser) {
    // A webhook arrived for a subscription we've never seen verified by a
    // logged-in user. Nothing to attach it to — ignore rather than guess.
    throw new Error("구독을 연결할 사용자를 찾을 수 없습니다.");
  }

  const canceledAt = v.status === "CANCELED" || v.status === "REFUNDED" ? new Date() : null;
  const id = existing[0]?.id ?? randomUUID();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "IapSubscription"
        ("id","user_id","platform","plan_id","product_id","original_id",
         "latest_transaction_id","status","auto_renew","environment",
         "current_period_end","purchased_at","canceled_at","raw","updated_at")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,CURRENT_TIMESTAMP)
      ON CONFLICT ("platform","original_id") DO UPDATE SET
        "user_id" = EXCLUDED."user_id",
        "plan_id" = EXCLUDED."plan_id",
        "product_id" = EXCLUDED."product_id",
        "latest_transaction_id" = EXCLUDED."latest_transaction_id",
        "status" = EXCLUDED."status",
        "auto_renew" = EXCLUDED."auto_renew",
        "environment" = EXCLUDED."environment",
        "current_period_end" = EXCLUDED."current_period_end",
        "purchased_at" = COALESCE("IapSubscription"."purchased_at", EXCLUDED."purchased_at"),
        "canceled_at" = EXCLUDED."canceled_at",
        "raw" = EXCLUDED."raw",
        "updated_at" = CURRENT_TIMESTAMP
    `,
    id,
    resolvedUser,
    v.platform,
    v.planId,
    v.productId,
    v.originalId,
    v.latestTransactionId,
    v.status,
    v.autoRenew,
    v.environment,
    v.expiresAt,
    v.purchasedAt,
    canceledAt,
    JSON.stringify(v.raw ?? null)
  );

  const rows = await prisma.$queryRawUnsafe<IapSubscriptionRow[]>(
    `SELECT * FROM "IapSubscription" WHERE "platform" = $1 AND "original_id" = $2 LIMIT 1`,
    v.platform,
    v.originalId
  );
  return rows[0];
}

export interface Entitlement {
  active: boolean;
  planId: PlanId | null;
  platform: Platform | null;
  status: SubStatus | null;
  expiresAt: string | null;
  autoRenew: boolean;
  environment: string | null;
  source: "iap" | "free" | "answer_king" | null; // free=무료 프리미엄(리퍼럴·수동), answer_king=답변왕 유지 중
}

const INACTIVE: Entitlement = {
  active: false,
  planId: null,
  platform: null,
  status: null,
  expiresAt: null,
  autoRenew: false,
  environment: null,
  source: null,
};

/** True while the user has any store subscription that is paid-through and not refunded. */
function isRowLive(row: IapSubscriptionRow, now: number): boolean {
  if (row.status === "REFUNDED" || row.status === "EXPIRED") return false;
  return new Date(row.current_period_end).getTime() > now;
}

/**
 * The user's current premium entitlement — the single check all feature gating
 * should use. Picks the subscription with the furthest period end so a user who
 * upgrades monthly → annual keeps the better one.
 */
export async function getActiveEntitlement(userId: string): Promise<Entitlement> {
  await ensureIapTables();
  const rows = await prisma.$queryRawUnsafe<IapSubscriptionRow[]>(
    `SELECT * FROM "IapSubscription" WHERE "user_id" = $1 ORDER BY "current_period_end" DESC`,
    userId
  );
  const now = Date.now();
  const live = rows.find((r) => isRowLive(r, now));
  if (live) {
    return {
      active: true,
      planId: live.plan_id,
      platform: live.platform,
      status: live.status,
      expiresAt: new Date(live.current_period_end).toISOString(),
      autoRenew: live.auto_renew,
      environment: live.environment,
      source: "iap",
    };
  }
  // 결제 구독이 없으면 무료 프리미엄(리퍼럴 보상 등)을 본다.
  const freeUntil = await getFreePremiumUntil(userId);
  if (freeUntil) {
    return {
      active: true,
      planId: null,
      platform: null,
      status: "ACTIVE",
      expiresAt: freeUntil.toISOString(),
      autoRenew: false,
      environment: null,
      source: "free",
    };
  }
  // 답변왕을 '유지하는 동안' 프리미엄 유지 — 만료일 없음(유지 여부를 매번 라이브로 판정).
  if (await isAnswerKing(userId)) {
    return {
      active: true,
      planId: null,
      platform: null,
      status: "ACTIVE",
      expiresAt: null,
      autoRenew: false,
      environment: null,
      source: "answer_king",
    };
  }
  return INACTIVE;
}

/** Cheap boolean form for gating checks. */
export async function isPremium(userId: string): Promise<boolean> {
  return (await getActiveEntitlement(userId)).active;
}
