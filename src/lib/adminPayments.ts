import { prisma } from "@/lib/prisma";
import { ensureIapTables } from "@/lib/iap/entitlements";
import { ensurePaymentTable } from "@/lib/payments";
import { ensureSubscriptionTables } from "@/lib/subscriptions";
import { getPlanById, resolvePlanPricing } from "@/lib/iap/plans";
import type { Platform } from "@/lib/iap/types";

// 어드민 결제 조회 — 세 결제 소스를 한 번에 모아 준다.
//  1) IapSubscription : 애플/구글 인앱결제 프리미엄 구독(현재 실사용 경로)
//  2) Payment         : 토스 단건 결제(한국사 PDF 등)
//  3) Subscription    : 토스 정기결제(구 월정액 — 레거시)

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
interface PaymentJoinRow {
  id: string;
  order_id: string;
  email: string | null;
  nickname: string | null;
  product_id: string;
  amount: number;
  status: string;
  method: string | null;
  approved_at: Date | null;
  created_at: Date;
}
interface SubJoinRow {
  id: string;
  email: string | null;
  nickname: string | null;
  plan_id: string;
  amount: number;
  status: string;
  card_company: string | null;
  card_number: string | null;
  current_period_end: Date;
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
export interface AdminTossPayment {
  id: string;
  orderId: string;
  email: string | null;
  nickname: string | null;
  productId: string;
  amount: number;
  status: string;
  method: string | null;
  approvedAt: string | null;
  createdAt: string;
}
export interface AdminTossSub {
  id: string;
  email: string | null;
  nickname: string | null;
  planId: string;
  amount: number;
  status: string;
  cardCompany: string | null;
  cardNumber: string | null;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
}

export interface AdminPaymentsResult {
  summary: {
    iapActive: number;
    iapTotal: number;
    tossPaidCount: number;
    tossPaidAmount: number;
    tossSubActive: number;
  };
  iap: AdminIapPayment[];
  toss: AdminTossPayment[];
  tossSub: AdminTossSub[];
}

const PLAN_LABEL: Record<string, string> = { apple: "App Store", google: "Google Play" };
export const platformLabel = (p: string) => PLAN_LABEL[p] ?? p;

function iapIsActive(row: IapJoinRow, now: number): boolean {
  if (row.status === "REFUNDED" || row.status === "EXPIRED") return false;
  return new Date(row.current_period_end).getTime() > now;
}

export async function getAdminPayments(): Promise<AdminPaymentsResult> {
  // 테이블이 아직 없을 수 있으니 먼저 보장(멱등). 없으면 JOIN 이 깨진다.
  await Promise.all([ensureIapTables(), ensurePaymentTable(), ensureSubscriptionTables()]);

  const [iapRows, tossRows, subRows] = await Promise.all([
    prisma.$queryRawUnsafe<IapJoinRow[]>(
      `SELECT s.*, u.email AS email, u.nickname AS nickname
       FROM "IapSubscription" s LEFT JOIN "User" u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    ),
    prisma.$queryRawUnsafe<PaymentJoinRow[]>(
      `SELECT p.id, p.order_id, p.product_id, p.amount, p.status, p.method, p.approved_at, p.created_at,
              u.email AS email, u.nickname AS nickname
       FROM "Payment" p LEFT JOIN "User" u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    ),
    prisma.$queryRawUnsafe<SubJoinRow[]>(
      `SELECT s.id, s.plan_id, s.amount, s.status, s.card_company, s.card_number,
              s.current_period_end, s.canceled_at, s.created_at,
              u.email AS email, u.nickname AS nickname
       FROM "Subscription" s LEFT JOIN "User" u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    ),
  ]);

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

  const toss: AdminTossPayment[] = tossRows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    email: r.email,
    nickname: r.nickname,
    productId: r.product_id,
    amount: r.amount,
    status: r.status,
    method: r.method,
    approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const tossSub: AdminTossSub[] = subRows.map((r) => ({
    id: r.id,
    email: r.email,
    nickname: r.nickname,
    planId: r.plan_id,
    amount: r.amount,
    status: r.status,
    cardCompany: r.card_company,
    cardNumber: r.card_number,
    currentPeriodEnd: new Date(r.current_period_end).toISOString(),
    canceledAt: r.canceled_at ? new Date(r.canceled_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  return {
    summary: {
      iapActive: iap.filter((r) => r.active).length,
      iapTotal: iap.length,
      tossPaidCount: toss.filter((r) => r.status === "DONE").length,
      tossPaidAmount: toss.filter((r) => r.status === "DONE").reduce((s, r) => s + r.amount, 0),
      tossSubActive: tossSub.filter((r) => r.status === "ACTIVE").length,
    },
    iap,
    toss,
    tossSub,
  };
}
