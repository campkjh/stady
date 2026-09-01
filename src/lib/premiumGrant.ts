import { prisma } from "@/lib/prisma";

// 결제 없이 주는 "무료 프리미엄" (리퍼럴 보상·운영 지급 등). raw SQL + CREATE TABLE
// IF NOT EXISTS — community/iap 모듈과 같은 패턴(스키마에 없는 테이블).
// 사용자당 한 행: expires_at 을 연장(누적)한다. 지급마다 max(현재만료, 지금) + N일.
// 프리미엄 판정은 iap/entitlements 의 getActiveEntitlement 가 IAP 가 없을 때 이 값을 본다.

let ready = false;
async function ensure() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PremiumGrant" (
      "user_id" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "expires_at" TIMESTAMP(3) NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'grant',
      "total_days" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ready = true;
}

/**
 * 무료 프리미엄 N일 지급(누적 연장). 이미 만료가 미래면 그 뒤로, 아니면 지금부터 N일.
 * 여러 번 부르면 계속 연장된다(친구 여러 명 초대 = N일씩 쌓임).
 */
export async function grantFreePremiumDays(userId: string, days: number, source = "grant"): Promise<Date> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ expires_at: Date }[]>(
    `
      INSERT INTO "PremiumGrant" ("user_id", "expires_at", "source", "total_days", "updated_at")
      VALUES ($1, now() + ($2 || ' days')::interval, $3, $2, now())
      ON CONFLICT ("user_id") DO UPDATE SET
        "expires_at" = GREATEST("PremiumGrant"."expires_at", now()) + ($2 || ' days')::interval,
        "total_days" = "PremiumGrant"."total_days" + $2,
        "source"     = EXCLUDED."source",
        "updated_at" = now()
      RETURNING "expires_at"
    `,
    userId,
    Math.max(0, Math.trunc(days)),
    source
  );
  return new Date(rows[0].expires_at);
}

/** 현재 활성인 무료 프리미엄 만료 시각(없거나 만료면 null). */
export async function getFreePremiumUntil(userId: string): Promise<Date | null> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ expires_at: Date }[]>(
    `SELECT "expires_at" FROM "PremiumGrant" WHERE "user_id" = $1 AND "expires_at" > now() LIMIT 1`,
    userId
  );
  return rows[0] ? new Date(rows[0].expires_at) : null;
}

/** 만료 여부와 무관하게 저장된 만료 시각(어드민 표시용 — 지난 것도 보인다). */
export async function getPremiumGrantRaw(userId: string): Promise<Date | null> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ expires_at: Date }[]>(
    `SELECT "expires_at" FROM "PremiumGrant" WHERE "user_id" = $1 LIMIT 1`,
    userId
  );
  return rows[0] ? new Date(rows[0].expires_at) : null;
}

export interface ActiveFreeGrant {
  userId: string;
  email: string | null;
  nickname: string | null;
  source: string;
  totalDays: number;
  expiresAt: string;
}

/** 현재 활성(만료 전)인 무료 프리미엄 지급 목록 — 어드민 조회/회수용. 만료 임박순. */
export async function listActiveFreeGrants(): Promise<ActiveFreeGrant[]> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{
    user_id: string; email: string | null; nickname: string | null;
    source: string; total_days: number; expires_at: Date;
  }[]>(
    `SELECT g."user_id", g."source", g."total_days", g."expires_at", u."email", u."nickname"
     FROM "PremiumGrant" g LEFT JOIN "User" u ON u."id" = g."user_id"
     WHERE g."expires_at" > now()
     ORDER BY g."expires_at" ASC`
  );
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    nickname: r.nickname,
    source: r.source,
    totalDays: Number(r.total_days) || 0,
    expiresAt: new Date(r.expires_at).toISOString(),
  }));
}

/** 무료 프리미엄 회수(지급 취소). */
export async function revokeFreePremium(userId: string): Promise<void> {
  await ensure();
  await prisma.$executeRawUnsafe(`DELETE FROM "PremiumGrant" WHERE "user_id" = $1`, userId);
}
