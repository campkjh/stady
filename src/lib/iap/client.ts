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
  Android?: {
    iapPurchase?: (json: string) => void;
    iapRestore?: () => void;
    showNativeLogin?: () => void;
  };
  __STADY_IAP__?: { onResult: (result: IapNativeResult | string) => void };
}
function nativeWindow(): NativeWindow {
  return window as unknown as NativeWindow;
}

/** Open the shell's native login sheet (same bridge LoginRequired uses). */
function requestNativeLogin() {
  const w = nativeWindow();
  if (w.webkit?.messageHandlers?.showNativeLogin) {
    w.webkit.messageHandlers.showNativeLogin.postMessage({});
    return;
  }
  if (typeof w.Android?.showNativeLogin === "function") {
    w.Android.showNativeLogin();
    return;
  }
  window.location.href = "/login";
}

/** Is there a signed-in stady account right now? Asked fresh (not from state)
 *  because the purchase must never start on a stale "logged in" assumption.
 *
 *  ⚠️ 확실히 "로그아웃"일 때만 false 를 돌려준다(fail-open). 네트워크가 한 번
 *  튀거나 서버가 5xx 를 주면 예전엔 false 가 되어, 멀쩡히 로그인한 사람에게
 *  "먼저 로그인해 주세요" 에러 + 로그인 시트가 떴다. 결제 자체는 어차피 서버
 *  검증(세션 필수)에서 막히므로, 여기서 막는 건 확정적인 경우로 한정한다. */
async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/iap/status", { credentials: "include" });
    if (!res.ok) return true; // 판단 불가 — 결제를 막지 않는다
    const data = await res.json();
    return data.authenticated !== false;
  } catch {
    return true; // 판단 불가 — 결제를 막지 않는다
  }
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
  // 여기까지 왔으면 스토어 결제는 이미 끝났다. 일시적인 네트워크/서버 오류로
  // 지급이 실패하면 사용자는 "돈만 내고 에러"를 보게 되므로 한 번 더 시도한다.
  // (그래도 실패하면 스토어 웹훅·구매 복원으로 회복 가능하다는 안내를 준다.)
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      res = null; // 네트워크 오류 — 재시도
      continue;
    }
    if (res.ok) return;
    if (res.status < 500) break; // 401/400 등은 재시도해도 같다
  }
  if (!res) throw new Error("네트워크가 불안정해요. 잠시 후 ‘구매 복원’을 눌러 주세요.");
  if (res.status === 401) {
    // 결제 도중 세션이 끊긴 경우. 결제는 애플/구글에 남아 있으므로 로그인 후
    // '구매 복원'을 누르면 그대로 지급된다.
    throw new Error("로그인이 풀렸어요. 다시 로그인한 뒤 ‘구매 복원’을 누르면 구독이 적용됩니다.");
  }
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || "결제 검증에 실패했습니다.");
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
  /** 플랫폼별 가격 차이(Apple 가격표 제약 등). refresh() 에서 이미 적용해 내려주므로
   *  화면은 신경 쓸 필요 없다 — 위의 priceKrw/monthlyEquivalentKrw 가 곧 청구액이다. */
  overrides?: Partial<Record<Platform, { priceKrw: number; monthlyEquivalentKrw: number }>> | null;
}

/** 실행 중인 플랫폼의 실제 청구액으로 가격을 확정한다. 화면에 크게 쓰는 가격이
 *  스토어 결제 시트 금액과 달라지면 App Store 3.1.2(c) 위반이다. */
function applyPlatformPricing(plans: IapPlanView[], platform: Platform | null): IapPlanView[] {
  return plans.map((p) => {
    const o = platform ? p.overrides?.[platform] : undefined;
    return o ? { ...p, priceKrw: o.priceKrw, monthlyEquivalentKrw: o.monthlyEquivalentKrw } : p;
  });
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
  const [authenticated, setAuthenticated] = useState(true); // 확인 전엔 버튼 문구를 흔들지 않는다
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/iap/status", { credentials: "include" });
      const data = await res.json();
      setPlans(applyPlatformPricing(data.plans ?? [], detectPlatform()));
      setEntitlement(data.entitlement ?? null);
      setAuthenticated(!!data.authenticated);
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
        // 로그인 없이는 결제를 시작하지 않는다. 구독권은 서버에서 "계정"에 붙는데
        // (/api/iap/apple/verify 는 세션 필수), 예전엔 로그아웃 상태에서도 결제
        // 시트가 떠서 돈만 빠져나가고 검증이 401 로 떨어졌다 — 사용자에겐 결제
        // 직후 에러만 보였다(App Review 2.1(b) 리젝, 2026-08-22).
        if (!(await isAuthenticated())) {
          requestNativeLogin();
          throw new Error("구독하려면 먼저 로그인해 주세요. 로그인 후 다시 시도하면 됩니다.");
        }
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
    /** 스타디 계정으로 로그인돼 있는지 — 결제는 로그인 상태에서만 시작된다. */
    authenticated,
    loading,
    busy,
    purchase,
    restore,
    refresh,
  };
}
