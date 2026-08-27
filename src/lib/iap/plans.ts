import type { IapPlan, PlanId, Platform } from "./types";

// Store product IDs. Defaults follow a kr.co.stady.* convention but are
// overridable via env so the real App Store Connect / Play Console IDs can be
// wired without a code change. Whatever is set here MUST match the product IDs
// created in each store console exactly.
const APPLE_MONTHLY = process.env.IAP_APPLE_MONTHLY_ID || "com.stady.app.monthly";
const APPLE_ANNUAL = process.env.IAP_APPLE_ANNUAL_ID || "com.stady.app.suneung.annual";
const GOOGLE_MONTHLY = process.env.IAP_GOOGLE_MONTHLY_ID || "stady_sub_monthly";
const GOOGLE_ANNUAL = process.env.IAP_GOOGLE_ANNUAL_ID || "annual";

// The two plans that replace the old Toss monthly-pass. Single source of truth
// shared by the web UI, the status endpoint, and receipt verification (reverse
// lookup by store product id).
export const IAP_PLANS: Record<PlanId, IapPlan> = {
  monthly: {
    id: "monthly",
    name: "월간 구독",
    tagline: "부담 없이 시작하는 표준 요금제",
    priceKrw: 13900,
    period: "month",
    monthlyEquivalentKrw: 13900,
    productIds: { apple: APPLE_MONTHLY, google: GOOGLE_MONTHLY },
  },
  suneung_annual: {
    id: "suneung_annual",
    name: "수능 구독",
    tagline: "수능 완주 학습자용 추천",
    priceKrw: 118800,
    period: "year",
    monthlyEquivalentKrw: 9900, // 118,800 ÷ 12
    // 13,900 × 12 = 166,800원 기준 118,800원 → 28.8% 할인. 30% 로 올려 쓰면 실제보다
    // 부풀린 표기가 된다(3.1.2c 로 이미 한 번 리젝당한 항목이라 내림으로 맞춘다).
    // 119,000원(Apple)은 28.7% 라 배지는 양쪽 다 29% 로 같다.
    discountPct: 29,
    badge: "29% 할인",
    recommended: true,
    productIds: { apple: APPLE_ANNUAL, google: GOOGLE_ANNUAL },
    // Apple 가격표에는 118,800원이 없다 — 원화 10만원 초과 구간은 1,000원 단위라
    // 118,000 다음이 곧장 119,000 이다. 화면에 크게 쓰는 가격이 실제 청구액과
    // 달라지면 3.1.2(c) 위반이므로 iOS 에서만 119,000원으로 표시한다.
    // Google Play 는 임의 금액이 가능해 118,800원 그대로 둔다.
    overrides: {
      apple: { priceKrw: 119000, monthlyEquivalentKrw: 9917 }, // 119,000 ÷ 12 = 9,916.67
    },
  },
};

/** Display order for the plan picker. */
export const IAP_PLAN_LIST: IapPlan[] = [IAP_PLANS.monthly, IAP_PLANS.suneung_annual];

/**
 * 해당 플랫폼에서 실제로 청구되는 가격. 오버라이드가 없으면 기본값을 그대로 쓴다.
 * 플랫폼을 모를 때(웹 브라우저 — 결제 자체가 불가)는 기본값을 보여준다.
 */
export function resolvePlanPricing(
  plan: IapPlan,
  platform: Platform | null
): { priceKrw: number; monthlyEquivalentKrw: number } {
  const override = platform ? plan.overrides?.[platform] : undefined;
  return {
    priceKrw: override?.priceKrw ?? plan.priceKrw,
    monthlyEquivalentKrw: override?.monthlyEquivalentKrw ?? plan.monthlyEquivalentKrw,
  };
}

export function getPlanById(id: string | null | undefined): IapPlan | null {
  if (!id) return null;
  return IAP_PLANS[id as PlanId] ?? null;
}

/** Resolve the store product id a given plan uses on a given platform. */
export function productIdFor(planId: PlanId, platform: Platform): string {
  return IAP_PLANS[planId].productIds[platform];
}

/**
 * Reverse lookup: given a store product id (from a verified receipt), find which
 * internal plan it maps to. Returns null for unknown ids (defensive — a receipt
 * for a product we don't recognize should not grant entitlement).
 */
export function planForProductId(productId: string): IapPlan | null {
  for (const plan of IAP_PLAN_LIST) {
    if (plan.productIds.apple === productId || plan.productIds.google === productId) {
      return plan;
    }
  }
  return null;
}
