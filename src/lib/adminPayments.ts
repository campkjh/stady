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

// 전월 코호트 해지율 — "전월에 구독한 사람 대비 취소한 사람".
export interface AdminChurn {
  monthLabel: string; // 전월 (예: "2026.08")
  newSubs: number; // 전월 신규 구독 수
  canceled: number; // 그중 해지(환불·해지 확정 + 자동갱신 해제)
  ratePct: number; // 해지 / 신규 × 100
}

// 정산 추정. 스토어 수수료율은 프로그램 가입 여부(애플 소규모 개발자/구글 첫 100만$)에
// 따라 15% 또는 30% 라 서버는 총액만 주고, 화면에서 비율을 골라 환산한다.
export interface AdminRevenue {
  grossKrw: number; // 누적 결제액(환불·샌드박스 제외)
  googleGrossKrw: number;
  appleGrossKrw: number;
  mrrKrw: number; // 활성 구독 월 환산(연간은 ÷12)
}

export interface AdminPaymentsResult {
  summary: {
    active: number; // 전체 활성 구독
    total: number; // 전체 구독(만료·환불 포함)
    googleActive: number; // 안드로이드(구글) 활성
    appleActive: number; // 앱스토어(애플) 활성
    freeActive: number; // 무료 이용중(결제 없는 지급 — 친구초대·수동지급)
    refunded: number; // 환불된 구독(스토어 웹훅으로 REFUNDED 기록)
  };
  iap: AdminIapPayment[];
  free: ActiveFreeGrant[]; // 무료 프리미엄 지급(결제 아님) — 개별 회수 가능
  churn: AdminChurn;
  revenue: AdminRevenue;
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

  // ── 통계는 테스트(Sandbox) 건을 제외한다. 실제 매출/해지가 아니다.
  const real = iap.filter((r) => r.environment !== "Sandbox");
  // 해지로 보는 기준: 환불·해지 확정이거나, 자동갱신을 꺼둔 상태(= 갱신 안 됨).
  const isCanceledLike = (r: AdminIapPayment) =>
    r.status === "REFUNDED" || r.status === "CANCELED" || !r.autoRenew;

  // 전월 코호트: 구매일(없으면 생성일)이 지난달인 구독.
  const nowDate = new Date();
  const prevStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const prevEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const monthLabel = `${prevStart.getFullYear()}.${String(prevStart.getMonth() + 1).padStart(2, "0")}`;
  const prevCohort = real.filter((r) => {
    const t = new Date(r.purchasedAt ?? r.createdAt).getTime();
    return t >= prevStart.getTime() && t < prevEnd.getTime();
  });
  const prevCanceled = prevCohort.filter(isCanceledLike).length;

  // 정산: 환불 건은 수입이 아니므로 뺀다. 연간권은 월 환산해 MRR 에 반영.
  const paid = real.filter((r) => r.status !== "REFUNDED");
  const sum = (rows: AdminIapPayment[]) => rows.reduce((a, r) => a + (r.amountKrw ?? 0), 0);
  const monthlyEquiv = (r: AdminIapPayment) => {
    const plan = getPlanById(r.planId);
    if (!plan) return 0;
    return resolvePlanPricing(plan, r.platform).monthlyEquivalentKrw;
  };
  return {
    summary: {
      active: active.length,
      total: iap.length,
      googleActive: active.filter((r) => r.platform === "google").length,
      appleActive: active.filter((r) => r.platform === "apple").length,
      freeActive: free.length,
      refunded: iap.filter((r) => r.status === "REFUNDED").length,
    },
    iap,
    free,
    churn: {
      monthLabel,
      newSubs: prevCohort.length,
      canceled: prevCanceled,
      ratePct: prevCohort.length ? Math.round((prevCanceled / prevCohort.length) * 1000) / 10 : 0,
    },
    revenue: {
      grossKrw: sum(paid),
      googleGrossKrw: sum(paid.filter((r) => r.platform === "google")),
      appleGrossKrw: sum(paid.filter((r) => r.platform === "apple")),
      mrrKrw: paid.filter((r) => r.active).reduce((a, r) => a + monthlyEquiv(r), 0),
    },
  };
}
