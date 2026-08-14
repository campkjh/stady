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
    discountPct: 30,
    badge: "30% 할인",
    recommended: true,
    productIds: { apple: APPLE_ANNUAL, google: GOOGLE_ANNUAL },
  },
};

/** Display order for the plan picker. */
export const IAP_PLAN_LIST: IapPlan[] = [IAP_PLANS.monthly, IAP_PLANS.suneung_annual];

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
