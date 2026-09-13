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
 * 결제 구독이 살아 있으면 그 종료 시각, 아니면 null.
 * entitlements 를 import 하면 순환이 되므로(그쪽이 이 파일을 쓴다) 같은 조건을 직접 조회한다.
 * 조건은 getActiveEntitlement 의 isRowLive 와 일치시킬 것.
 */
export async function getLivePaidEnd(userId: string): Promise<Date | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ pe: Date | null }[]>(
      `SELECT MAX("current_period_end") AS pe FROM "IapSubscription"
       WHERE "user_id" = $1 AND "status" NOT IN ('REFUNDED', 'EXPIRED') AND "current_period_end" > now()`,
      userId
    );
    return rows[0]?.pe ? new Date(rows[0].pe) : null;
  } catch {
    // IapSubscription 테이블이 아직 없는 환경(신규 DB)이면 결제가 없는 것으로 본다.
    return null;
  }
}

/**
 * 무료 프리미엄 N일 지급(누적 연장).
 *
 * 시작점은 "이미 프리미엄이 보장된 마지막 시점" — 기존 무료 만료·**결제 구독 종료**·지금 중 가장 늦은 때다.
 * 결제 구독을 쓰는 중에 받은 보상을 now() 부터 세면 유료 기간에 통째로 묻혀 하루도 못 쓴다
 * (자격 우선순위가 IAP → 무료라 유료가 사는 동안 무료는 보이지도 않는다). 실제로 초대 보상 4건이
 * 이렇게 소멸했다(2026-09-13). 여러 번 부르면 계속 뒤로 쌓인다.
 */
export async function grantFreePremiumDays(userId: string, days: number, source = "grant"): Promise<Date> {
  await ensure();
  const paidEnd = await getLivePaidEnd(userId);
  const rows = await prisma.$queryRawUnsafe<{ expires_at: Date }[]>(
    `
      INSERT INTO "PremiumGrant" ("user_id", "expires_at", "source", "total_days", "updated_at")
      VALUES ($1, GREATEST(now(), COALESCE($4::timestamptz, now())) + ($2 || ' days')::interval, $3, $2, now())
      ON CONFLICT ("user_id") DO UPDATE SET
        "expires_at" = GREATEST("PremiumGrant"."expires_at", now(), COALESCE($4::timestamptz, now())) + ($2 || ' days')::interval,
        "total_days" = "PremiumGrant"."total_days" + $2,
        "source"     = EXCLUDED."source",
        "updated_at" = now()
      RETURNING "expires_at"
    `,
    userId,
    Math.max(0, Math.trunc(days)),
    source,
    paidEnd
  );
  return new Date(rows[0].expires_at);
}

/**
 * 결제 구독이 바뀔 때(갱신·해지·환불) 무료 이용권을 그 뒤로 다시 민다.
 *
 * 남은 무료 일수 R = 무료만료 − (바뀌기 전 결제 종료, 결제가 없었으면 지금) 을 보존한 채
 * 새 결제 종료(없으면 지금) 뒤에 다시 붙인다. 이렇게 해야 **월 자동갱신 때마다** 보상이
 * 유료 기간에 다시 묻히는 일이 없다. 갱신 전 종료 시각은 호출부가 갱신 직전에 읽어 넘긴다.
 */
export async function shiftFreeGrantAfterPaidChange(userId: string, prevPaidEnd: Date | null): Promise<void> {
  await ensure();
  const rows = await prisma.$queryRawUnsafe<{ expires_at: Date }[]>(
    `SELECT "expires_at" FROM "PremiumGrant" WHERE "user_id" = $1 LIMIT 1`,
    userId
  );
  const current = rows[0]?.expires_at ? new Date(rows[0].expires_at) : null;
  if (!current) return;
  const now = Date.now();
  if (current.getTime() <= now) return; // 이미 다 쓴 이용권은 건드리지 않는다.

  const prevBase = prevPaidEnd && prevPaidEnd.getTime() > now ? prevPaidEnd.getTime() : now;
  const remainingMs = Math.max(0, current.getTime() - prevBase);
  const nextPaidEnd = await getLivePaidEnd(userId);
  const nextBase = nextPaidEnd && nextPaidEnd.getTime() > now ? nextPaidEnd.getTime() : now;
  const next = new Date(nextBase + remainingMs);
  if (Math.abs(next.getTime() - current.getTime()) < 60_000) return; // 의미 없는 차이는 건너뛴다.

  await prisma.$executeRawUnsafe(
    `UPDATE "PremiumGrant" SET "expires_at" = $2, "updated_at" = now() WHERE "user_id" = $1`,
    userId,
    next
  );
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
  expiresAt: string | null; // null = 만료일 없음(답변왕처럼 조건 유지 동안 지속)
  note?: string; // 부가 설명(예: 주간 댓글 수)
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
