"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Platform, PlanId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Native ⇄ Web IAP bridge contract  (implemented by the iOS/Android shells)
//
//  Web → Native (start a purchase / restore):
//    iOS      window.webkit.messageHandlers.iapPurchase.postMessage({ planId, productId })
//             window.webkit.messageHandlers.iapRestore.postMessage({})
//    Android  window.Android.iapPurchase(JSON.stringify({ planId, productId }))
//             window.Android.iapRestore()
//
//  Native → Web (deliver the result): the shell evaluates
//    window.__STADY_IAP__.onResult(<IapNativeResult as JS object or JSON string>)
//
//  The web then POSTs the receipt to /api/iap/{apple|google}/verify, where the
//  server re-verifies with the store before granting entitlement.
// ─────────────────────────────────────────────────────────────────────────────

export interface IapNativeResult {
  ok: boolean;
  platform?: Platform;
  planId?: PlanId;
  productId?: string;
  /** Apple: StoreKit2 transaction id (preferred) and/or the signed JWS. */
  transactionId?: string;
  signedTransaction?: string;
  /** Google: Play Billing purchase token. */
  purchaseToken?: string;
  environment?: "Production" | "Sandbox";
  /** "cancelled" when the user dismissed the store sheet. */
  error?: string;
  code?: string;
}

// Local view of the native bridge globals. We DON'T augment Window here because
// other pages (e.g. login) declare Window.webkit with a different, narrower
// shape — merging would conflict. Casting keeps this module self-contained.
interface NativeWindow {
  webkit?: { messageHandlers?: Record<string, { postMessage: (msg: unknown) => void }> };
  Android?: { iapPurchase?: (json: string) => void; iapRestore?: () => void };
  __STADY_IAP__?: { onResult: (result: IapNativeResult | string) => void };
}
function nativeWindow(): NativeWindow {
  return window as unknown as NativeWindow;
}

export function detectPlatform(): Platform | null {
  if (typeof window === "undefined") return null;
  const w = nativeWindow();
  if (w.webkit?.messageHandlers?.iapPurchase) return "apple";
  if (typeof w.Android?.iapPurchase === "function") return "google";
  return null;
}

function sendToNative(action: "iapPurchase" | "iapRestore", payload: Record<string, unknown>) {
  const w = nativeWindow();
  const platform = detectPlatform();
  if (platform === "apple") {
    w.webkit!.messageHandlers![action]!.postMessage(payload);
  } else if (platform === "google") {
    if (action === "iapPurchase") w.Android!.iapPurchase!(JSON.stringify(payload));
    else w.Android!.iapRestore?.();
  } else {
    throw new Error("인앱결제는 앱에서만 이용할 수 있어요.");
  }
}

/** Register a one-shot native callback and resolve when the result arrives.
 *
 * ⚠️ The timeout must comfortably outlast the ENTIRE store sheet flow — the user
 * reading the sheet, side-button/Face ID confirm, sandbox password entry, and
 * Apple's (slow) sandbox processing. A 30s timeout made App Review's purchases
 * "fail": the reviewer took ~2 minutes on the sheet, the timer fired, cleanup()
 * removed the callback, and the completed purchase's result had nowhere to land
 * (App Review rejection 2.1(b), 2026-08-21). The timeout is only a last-resort
 * guard against a dead bridge, so make it generous. */
function awaitNativeResult(timeoutMs = 10 * 60_000): Promise<IapNativeResult> {
  return new Promise<IapNativeResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("결제 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요."));
    }, timeoutMs);
    const w = nativeWindow();
    function cleanup() {
      clearTimeout(timer);
      if (w.__STADY_IAP__) delete w.__STADY_IAP__;
    }
    w.__STADY_IAP__ = {
      onResult(result) {
        cleanup();
        const parsed: IapNativeResult =
          typeof result === "string" ? (JSON.parse(result) as IapNativeResult) : result;
        resolve(parsed);
      },
    };
  });
}

async function verifyWithServer(result: IapNativeResult): Promise<void> {
  const endpoint = result.platform === "google" ? "/api/iap/google/verify" : "/api/iap/apple/verify";
  const payload =
    result.platform === "google"
      ? { purchaseToken: result.purchaseToken, productId: result.productId }
      : {
          transactionId: result.transactionId,
          signedTransaction: result.signedTransaction,
          environment: result.environment,
        };
  const res = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "결제 검증에 실패했습니다.");
  }
}

// ── Public types for the status endpoint ────────────────────────────────────
export interface IapPlanView {
  id: PlanId;
  name: string;
  tagline: string;
  priceKrw: number;
  period: "month" | "year";
  monthlyEquivalentKrw: number;
  discountPct: number | null;
  badge: string | null;
  recommended: boolean;
  productIds: Record<Platform, string>;
}
export interface EntitlementView {
  active: boolean;
  planId: PlanId | null;
  platform: Platform | null;
  status: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  environment: string | null;
}

/**
 * Subscription hook: loads plans + the current entitlement, and drives the
 * native purchase/restore flow. `inApp` is false in a plain browser (no native
 * bridge) — the UI should then show an "앱에서 구독하기" guide instead of a buy button.
 */
export function useIap() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [plans, setPlans] = useState<IapPlanView[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/iap/status", { credentials: "include" });
      const data = await res.json();
      setPlans(data.plans ?? []);
      setEntitlement(data.entitlement ?? null);
    } catch {
      /* ignore transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPlatform(detectPlatform());
    refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (planId: PlanId) => {
      if (busyRef.current) return;
      const plan = plans.find((p) => p.id === planId);
      const plat = detectPlatform();
      if (!plat) throw new Error("인앱결제는 앱에서만 이용할 수 있어요.");
      const productId = plan?.productIds[plat];
      if (!productId) throw new Error("상품 정보를 불러오지 못했어요.");

      busyRef.current = true;
      setBusy(true);
      try {
        const pending = awaitNativeResult();
        sendToNative("iapPurchase", { planId, productId });
        const result = await pending;
        if (!result.ok) {
          if (result.error === "cancelled") return; // user dismissed — silent
          throw new Error(result.error || "결제가 완료되지 않았어요.");
        }
        await verifyWithServer({ ...result, platform: result.platform ?? plat, productId });
        await refresh();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [plans, refresh]
  );

  const restore = useCallback(async () => {
    if (busyRef.current) return;
    if (!detectPlatform()) throw new Error("인앱결제는 앱에서만 이용할 수 있어요.");
    busyRef.current = true;
    setBusy(true);
    try {
      const pending = awaitNativeResult();
      sendToNative("iapRestore", {});
      const result = await pending;
      if (result.ok && (result.transactionId || result.purchaseToken || result.signedTransaction)) {
        await verifyWithServer(result);
      }
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [refresh]);

  return {
    /** true inside the native app (a purchase bridge exists). */
    inApp: platform !== null,
    platform,
    plans,
    entitlement,
    loading,
    busy,
    purchase,
    restore,
    refresh,
  };
}
