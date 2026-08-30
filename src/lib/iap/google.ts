import { createPrivateKey, createSign } from "crypto";
import { planForProductId } from "./plans";
import type { SubStatus, VerifiedSubscription } from "./types";

// Server-side Google Play receipt verification via the Play Developer API
// (purchases.subscriptionsv2.get). We authenticate a service account with an
// RS256-signed JWT (Node's built-in crypto — no external dependency), exchange
// it for an OAuth access token, then fetch the AUTHORITATIVE subscription state.
// The client-sent purchaseToken is only an identifier; truth comes from Google.
//
// Required env (set once the Play Console service account exists):
//   GOOGLE_PLAY_PACKAGE_NAME          — app package (e.g. kr.co.stady)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL      — service account client_email
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — service account private_key (PEM; \n allowed)

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANDROIDPUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export function googleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_PLAY_PACKAGE_NAME &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

let cachedToken: { token: string; exp: number } | null = null;

// 서비스 계정 private_key 를 어떤 형태로 넣어도 파싱되게 정규화한다.
// Vercel 등에 붙여넣을 때 흔히 깨지는 케이스를 모두 흡수:
//  · 앞뒤 따옴표  · 이스케이프 개행(\n, \r\n)  · 이중 이스케이프(\\n 잔재)
//  · \r  · PEM 헤더가 없으면 base64 통째로 넣은 것으로 보고 디코드
// (에러 error:1E08010C:DECODER routines::unsupported = 대부분 개행/이스케이프 문제)
export function normalizePrivateKey(raw: string): string {
  let k = (raw ?? "").trim();
  if (k.length >= 2 && (k[0] === '"' || k[0] === "'") && k[k.length - 1] === k[0]) {
    k = k.slice(1, -1);
  }
  if (!k.includes("BEGIN")) {
    try {
      const decoded = Buffer.from(k, "base64").toString("utf8");
      if (decoded.includes("BEGIN")) k = decoded;
    } catch {
      /* base64 아님 — 그대로 둔다 */
    }
  }
  k = k
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\\n/g, "\n"); // 이중 이스케이프로 남은 "역슬래시+개행" 정리
  return k;
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKeyPem = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!);

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(createPrivateKey(privateKeyPem));
  const assertion = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    throw new Error("Google 액세스 토큰 발급에 실패했습니다.");
  }
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

interface GoogleLineItem {
  productId?: string;
  expiryTime?: string; // RFC3339
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
}
interface GoogleSubscriptionV2 {
  subscriptionState?: string;
  latestOrderId?: string;
  startTime?: string;
  testPurchase?: unknown;
  lineItems?: GoogleLineItem[];
}

function mapGoogleState(state: string | undefined, autoRenew: boolean): SubStatus {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "ACTIVE";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "GRACE";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "PAUSED";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "CANCELED";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "EXPIRED";
    default:
      return autoRenew ? "ACTIVE" : "EXPIRED";
  }
}

/** Fetch and normalize the authoritative subscription state for a purchase token. */
export async function verifyGooglePurchase(input: {
  productId?: string;
  purchaseToken: string;
}): Promise<VerifiedSubscription> {
  if (!googleConfigured()) throw new GoogleNotConfiguredError();

  const token = await getGoogleAccessToken();
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME!;
  const res = await fetch(
    `${ANDROIDPUBLISHER}/applications/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
      input.purchaseToken
    )}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Google API ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const sub = (await res.json()) as GoogleSubscriptionV2;

  const lineItems = sub.lineItems ?? [];
  const autoRenew = lineItems.some((li) => li.autoRenewingPlan?.autoRenewEnabled);
  // Furthest expiry across line items = the period end.
  const expiryMs = lineItems.reduce((max, li) => {
    const t = li.expiryTime ? new Date(li.expiryTime).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  const productId = input.productId ?? lineItems[0]?.productId ?? "";

  const plan = planForProductId(productId);
  if (!plan) throw new Error(`알 수 없는 상품입니다: ${productId}`);

  return {
    platform: "google",
    planId: plan.id,
    productId,
    originalId: input.purchaseToken,
    latestTransactionId: sub.latestOrderId ?? null,
    status: mapGoogleState(sub.subscriptionState, autoRenew),
    autoRenew,
    environment: sub.testPurchase ? "Sandbox" : "Production",
    expiresAt: new Date(expiryMs || Date.now()),
    purchasedAt: sub.startTime ? new Date(sub.startTime) : null,
    raw: sub,
  };
}

export interface GoogleRtdn {
  purchaseToken?: string;
  productId?: string;
  notificationType?: number;
  voided?: boolean;
}

/**
 * Decode a Real-time Developer Notification (RTDN) delivered via Pub/Sub push.
 * Body shape: { message: { data: base64(JSON) }, subscription }. We only extract
 * the purchaseToken/productId; the webhook handler then re-fetches the
 * authoritative state via verifyGooglePurchase.
 */
export function decodeGoogleNotification(body: unknown): GoogleRtdn | null {
  const message = (body as { message?: { data?: string } })?.message;
  if (!message?.data) return null;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
  } catch {
    return null;
  }
  const subNotif = json.subscriptionNotification as
    | { notificationType?: number; purchaseToken?: string; subscriptionId?: string }
    | undefined;
  if (subNotif?.purchaseToken) {
    return {
      purchaseToken: subNotif.purchaseToken,
      productId: subNotif.subscriptionId,
      notificationType: subNotif.notificationType,
      voided: subNotif.notificationType === 12, // SUBSCRIPTION_REVOKED
    };
  }
  const voided = json.voidedPurchaseNotification as { purchaseToken?: string } | undefined;
  if (voided?.purchaseToken) {
    return { purchaseToken: voided.purchaseToken, voided: true };
  }
  return null; // testNotification or unknown — nothing to act on
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super("Google 인앱결제가 아직 구성되지 않았습니다.");
    this.name = "GoogleNotConfiguredError";
  }
}
