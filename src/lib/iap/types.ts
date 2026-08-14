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
