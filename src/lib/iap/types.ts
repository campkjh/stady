// Shared types for the in-app purchase (IAP) subscription system.
//
// The app is a WebView shell (iOS/StoreKit2, Android/Play Billing). Apple and
// Google require digital subscriptions to be sold through their own billing —
// so Toss(웹 PG) is NOT used inside the app. The native shell performs the store
// purchase, then hands the receipt/token back to the web layer, which POSTs it
// to /api/iap/*/verify. The SERVER always re-verifies with Apple/Google before
// granting entitlement — the client receipt is never trusted on its own.

export type Platform = "apple" | "google";

/** Internal plan identifiers (stable, platform-agnostic). */
export type PlanId = "monthly" | "suneung_annual";

/** A purchasable subscription plan (display metadata + store product ids). */
export interface IapPlan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Amount actually charged for one period, in KRW. */
  priceKrw: number;
  period: "month" | "year";
  /** Per-month price for display (e.g. annual shown as “9,900원/월 상당”). */
  monthlyEquivalentKrw: number;
  discountPct?: number;
  badge?: string;
  recommended?: boolean;
  productIds: Record<Platform, string>;
  /**
   * 플랫폼별 가격 차이. Apple 은 정해진 가격 포인트 중에서만 고를 수 있어서
   * (원화 10만원 초과 구간은 1,000원 단위) Google Play 와 같은 금액을 쓸 수 없는
   * 경우가 있다. 화면에 크게 쓰는 가격은 반드시 실제 청구액과 같아야 하므로
   * (App Store 3.1.2c) 그럴 땐 여기에 해당 플랫폼 값을 덮어쓴다.
   * 없으면 위의 priceKrw/monthlyEquivalentKrw 를 그대로 쓴다.
   */
  overrides?: Partial<Record<Platform, { priceKrw: number; monthlyEquivalentKrw: number }>>;
}

/**
 * Normalized subscription status across both stores.
 * ACTIVE   — paid & within the current period
 * GRACE    — billing retry / grace period (still entitled)
 * CANCELED — auto-renew off, but entitled until current_period_end
 * EXPIRED  — period ended, not renewed
 * REFUNDED — refunded/revoked → entitlement removed immediately
 * PAUSED   — (Google) subscription paused
 */
export type SubStatus =
  | "ACTIVE"
  | "GRACE"
  | "CANCELED"
  | "EXPIRED"
  | "REFUNDED"
  | "PAUSED";

/**
 * The authoritative subscription state after the server verifies a receipt with
 * Apple/Google. Everything the entitlement store needs to record one row.
 */
export interface VerifiedSubscription {
  platform: Platform;
  planId: PlanId;
  productId: string;
  /** Stable identity of the subscription for renewals.
   *  Apple: originalTransactionId · Google: purchaseToken */
  originalId: string;
  /** Most recent transaction/order id (for logging/support). */
  latestTransactionId: string | null;
  status: SubStatus;
  autoRenew: boolean;
  environment: "Production" | "Sandbox";
  /** Current period end — entitlement is live while now < expiresAt (unless REFUNDED). */
  expiresAt: Date;
  purchasedAt: Date | null;
  /** Last verified store payload, stored for debugging/audit. */
  raw?: unknown;
}
