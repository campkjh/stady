import { prisma } from "@/lib/prisma";
import { ensureIapTables } from "@/lib/iap/entitlements";
import { getPlanById, resolvePlanPricing } from "@/lib/iap/plans";
import { listActiveFreeGrants, type ActiveFreeGrant } from "@/lib/premiumGrant";
import type { Platform } from "@/lib/iap/types";

// 어드민 결제 조회 — 실제 결제 채널은 인앱결제(IAP) 둘뿐이라 그것만 모은다.
//  · IapSubscription : 애플(앱스토어)/구글(안드로이드) 인앱결제 프리미엄 구독
// 토스(Payment·Subscription)는 실제 연결·심사가 안 된 개발 잔여물이라 제외한다
// (어드민에 '결제된 것처럼' 보이면 오해를 부른다 — 2026-08-31 사용자 확인).

interface IapJoinRow {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  platform: Platform;
  plan_id: string;
  product_id: string;
  status: string;
  auto_renew: boolean;
  environment: string;
  current_period_end: Date;
  purchased_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
}

export interface AdminIapPayment {
  id: string;
  email: string | null;
  nickname: string | null;
  platform: Platform;
  planId: string;
  planName: string;
  productId: string;
  amountKrw: number | null;
  status: string;
  active: boolean;
  autoRenew: boolean;
  environment: string;
  purchasedAt: string | null;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
}

export interface AdminPaymentsResult {
  summary: {
    active: number; // 전체 활성 구독
    total: number; // 전체 구독(만료·환불 포함)
    googleActive: number; // 안드로이드(구글) 활성
    appleActive: number; // 앱스토어(애플) 활성
    freeActive: number; // 무료 이용중(결제 없는 지급 — 친구초대·수동지급)
  };
  iap: AdminIapPayment[];
  free: ActiveFreeGrant[]; // 무료 프리미엄 지급(결제 아님) — 개별 회수 가능
}

const PLAN_LABEL: Record<string, string> = { apple: "App Store", google: "Google Play" };
export const platformLabel = (p: string) => PLAN_LABEL[p] ?? p;

function iapIsActive(row: IapJoinRow, now: number): boolean {
  if (row.status === "REFUNDED" || row.status === "EXPIRED") return false;
  return new Date(row.current_period_end).getTime() > now;
}

export async function getAdminPayments(): Promise<AdminPaymentsResult> {
  await ensureIapTables();

  const iapRows = await prisma.$queryRawUnsafe<IapJoinRow[]>(
    `SELECT s.*, u.email AS email, u.nickname AS nickname
     FROM "IapSubscription" s LEFT JOIN "User" u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  );

  const now = Date.now();

  const iap: AdminIapPayment[] = iapRows.map((r) => {
    const plan = getPlanById(r.plan_id);
    const pricing = plan ? resolvePlanPricing(plan, r.platform) : null;
    return {
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      platform: r.platform,
      planId: r.plan_id,
      planName: plan?.name ?? r.plan_id,
      productId: r.product_id,
      amountKrw: pricing?.priceKrw ?? null,
      status: r.status,
      active: iapIsActive(r, now),
      autoRenew: r.auto_renew,
      environment: r.environment,
      purchasedAt: r.purchased_at ? new Date(r.purchased_at).toISOString() : null,
      currentPeriodEnd: new Date(r.current_period_end).toISOString(),
      canceledAt: r.canceled_at ? new Date(r.canceled_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    };
  });

  const active = iap.filter((r) => r.active);
  const free = await listActiveFreeGrants();
  return {
    summary: {
      active: active.length,
      total: iap.length,
      googleActive: active.filter((r) => r.platform === "google").length,
      appleActive: active.filter((r) => r.platform === "apple").length,
      freeActive: free.length,
    },
    iap,
    free,
  };
}
