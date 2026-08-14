import { createPrivateKey, sign as cryptoSign } from "crypto";
import { planForProductId } from "./plans";
import type { SubStatus, VerifiedSubscription } from "./types";

// Server-side Apple receipt verification via the App Store Server API.
// We authenticate with an App Store Connect API key (ES256, signed with Node's
// built-in crypto — no external JWT dependency) and fetch the AUTHORITATIVE
// transaction/subscription state directly from Apple. The client-sent receipt is
// only used to learn which transaction to look up; it is never trusted as-is.
//
// Required env (set once the App Store Connect API key exists):
//   APPLE_IAP_ISSUER_ID   — App Store Connect API key issuer id (UUID)
//   APPLE_IAP_KEY_ID      — the key id (kid)
//   APPLE_IAP_PRIVATE_KEY — the .p8 private key contents (PEM; \n allowed)
//   APPLE_BUNDLE_ID       — the app bundle id (e.g. kr.co.stady)

const PROD_HOST = "https://api.storekit.itunes.apple.com";
const SANDBOX_HOST = "https://api.storekit-sandbox.itunes.apple.com";

export function appleConfigured(): boolean {
  return !!(
    process.env.APPLE_IAP_ISSUER_ID &&
    process.env.APPLE_IAP_KEY_ID &&
    process.env.APPLE_IAP_PRIVATE_KEY &&
    process.env.APPLE_BUNDLE_ID
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Decode a JWS (JWT-shaped) payload segment. Apple's responses are signed by
 *  Apple and delivered over an authenticated TLS call, so the payload is trusted
 *  once fetched from the App Store Server API. */
function decodeJwsPayload<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length < 2) throw new Error("잘못된 Apple 서명 페이로드입니다.");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as T;
}

/** Build the ES256 bearer JWT the App Store Server API requires. */
function appleAuthToken(): string {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID!;
  const keyId = process.env.APPLE_IAP_KEY_ID!;
  const bundleId = process.env.APPLE_BUNDLE_ID!;
  const privateKeyPem = process.env.APPLE_IAP_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60, // Apple allows up to 20 minutes
    aud: "appstoreconnect-v1",
    bid: bundleId,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(privateKeyPem);
  // ieee-p1363 → raw R||S signature, as JOSE/ES256 requires.
  const signature = cryptoSign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

/** GET against the App Store Server API, trying the hinted environment first
 *  then the other (Apple recommends prod→sandbox fallback). */
async function appleGet(path: string, environmentHint?: "Production" | "Sandbox") {
  const token = appleAuthToken();
  const order: string[] =
    environmentHint === "Sandbox" ? [SANDBOX_HOST, PROD_HOST] : [PROD_HOST, SANDBOX_HOST];

  let lastError: unknown = null;
  for (const host of order) {
    const res = await fetch(`${host}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const env: "Production" | "Sandbox" = host === SANDBOX_HOST ? "Sandbox" : "Production";
      return { data: (await res.json()) as Record<string, unknown>, environment: env };
    }
    // 404 usually means "wrong environment" — fall through and try the other host.
    if (res.status !== 404) {
      lastError = new Error(`Apple API ${res.status}: ${await res.text().catch(() => "")}`);
    }
  }
  throw lastError ?? new Error("Apple 거래를 찾을 수 없습니다.");
}

interface AppleTransactionInfo {
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  purchaseDate?: number;
  expiresDate?: number;
  type?: string;
  environment?: string;
}

interface AppleRenewalInfo {
  autoRenewStatus?: number; // 0 off, 1 on
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
}

/** status codes from GET /inApps/v1/subscriptions/{originalTransactionId} */
function mapAppleStatus(statusCode: number | undefined, autoRenew: boolean): SubStatus {
  switch (statusCode) {
    case 1:
      return "ACTIVE";
    case 3: // billing retry
    case 4: // grace period
      return "GRACE";
    case 5:
      return "REFUNDED";
    case 2:
    default:
      return autoRenew ? "EXPIRED" : "CANCELED";
  }
}

/**
 * Verify a purchase by transactionId and return the authoritative subscription
 * state. `signedTransaction` (a StoreKit2 JWS) is accepted as an alternative way
 * to learn the transactionId when the client couldn't send it directly.
 */
export async function verifyAppleTransaction(input: {
  transactionId?: string;
  signedTransaction?: string;
  environmentHint?: "Production" | "Sandbox";
}): Promise<VerifiedSubscription> {
  if (!appleConfigured()) {
    throw new AppleNotConfiguredError();
  }

  let transactionId = input.transactionId;
  if (!transactionId && input.signedTransaction) {
    const decoded = decodeJwsPayload<AppleTransactionInfo>(input.signedTransaction);
    transactionId = decoded.transactionId;
  }
  if (!transactionId) throw new Error("transactionId가 필요합니다.");

  // 1) Look up the transaction to learn the originalTransactionId + environment.
  const txnResp = await appleGet(`/inApps/v1/transactions/${transactionId}`, input.environmentHint);
  const signedTxn = txnResp.data.signedTransactionInfo as string | undefined;
  if (!signedTxn) throw new Error("Apple 거래 정보를 찾을 수 없습니다.");
  const txn = decodeJwsPayload<AppleTransactionInfo>(signedTxn);
  const environment = txnResp.environment;

  // 2) Fetch the group's latest subscription state for autoRenew/status/expiry.
  const subResp = await appleGet(
    `/inApps/v1/subscriptions/${txn.originalTransactionId}`,
    environment
  );
  const groups = (subResp.data.data as Array<Record<string, unknown>> | undefined) ?? [];
  let latestTxn: AppleTransactionInfo = txn;
  let renewal: AppleRenewalInfo = {};
  let statusCode: number | undefined;
  for (const group of groups) {
    const lastTxns = (group.lastTransactions as Array<Record<string, unknown>> | undefined) ?? [];
    const match =
      lastTxns.find((t) => {
        const info = t.signedTransactionInfo
          ? decodeJwsPayload<AppleTransactionInfo>(t.signedTransactionInfo as string)
          : null;
        return info?.originalTransactionId === txn.originalTransactionId;
      }) ?? lastTxns[0];
    if (match) {
      if (match.signedTransactionInfo) {
        latestTxn = decodeJwsPayload<AppleTransactionInfo>(match.signedTransactionInfo as string);
      }
      if (match.signedRenewalInfo) {
        renewal = decodeJwsPayload<AppleRenewalInfo>(match.signedRenewalInfo as string);
      }
      statusCode = match.status as number | undefined;
      break;
    }
  }

  const plan = planForProductId(latestTxn.productId);
  if (!plan) throw new Error(`알 수 없는 상품입니다: ${latestTxn.productId}`);

  const autoRenew = renewal.autoRenewStatus === 1;
  const expiresMs =
    latestTxn.expiresDate ?? renewal.gracePeriodExpiresDate ?? Date.now();

  return {
    platform: "apple",
    planId: plan.id,
    productId: latestTxn.productId,
    originalId: latestTxn.originalTransactionId,
    latestTransactionId: latestTxn.transactionId,
    status: mapAppleStatus(statusCode, autoRenew),
    autoRenew,
    environment,
    expiresAt: new Date(expiresMs),
    purchasedAt: latestTxn.purchaseDate ? new Date(latestTxn.purchaseDate) : null,
    raw: { transaction: latestTxn, renewal, statusCode },
  };
}

interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    environment?: string;
    bundleId?: string;
  };
}

/**
 * Decode an App Store Server Notification V2 (`signedPayload`) into a
 * VerifiedSubscription we can upsert. Returns the notification type too so the
 * caller can log/branch. Refund/revoke notifications map to REFUNDED.
 */
export async function verifyAppleNotification(signedPayload: string): Promise<{
  notificationType: string;
  subtype?: string;
  verified: VerifiedSubscription | null;
}> {
  const payload = decodeJwsPayload<AppleNotificationPayload>(signedPayload);
  const info = payload.data?.signedTransactionInfo
    ? decodeJwsPayload<AppleTransactionInfo>(payload.data.signedTransactionInfo)
    : null;
  const renewal = payload.data?.signedRenewalInfo
    ? decodeJwsPayload<AppleRenewalInfo>(payload.data.signedRenewalInfo)
    : {};

  if (!info) {
    return { notificationType: payload.notificationType, subtype: payload.subtype, verified: null };
  }
  const plan = planForProductId(info.productId);
  if (!plan) {
    return { notificationType: payload.notificationType, subtype: payload.subtype, verified: null };
  }

  const isRefund =
    payload.notificationType === "REFUND" || payload.notificationType === "REVOKE";
  const autoRenew = renewal.autoRenewStatus === 1;
  let status: SubStatus;
  if (isRefund) status = "REFUNDED";
  else if (payload.notificationType === "EXPIRED") status = "EXPIRED";
  else if (payload.notificationType === "DID_CHANGE_RENEWAL_STATUS" && !autoRenew) status = "CANCELED";
  else if (payload.notificationType === "GRACE_PERIOD_EXPIRED") status = "EXPIRED";
  else status = "ACTIVE";

  const environment: "Production" | "Sandbox" =
    payload.data?.environment === "Sandbox" ? "Sandbox" : "Production";

  return {
    notificationType: payload.notificationType,
    subtype: payload.subtype,
    verified: {
      platform: "apple",
      planId: plan.id,
      productId: info.productId,
      originalId: info.originalTransactionId,
      latestTransactionId: info.transactionId,
      status,
      autoRenew,
      environment,
      expiresAt: new Date(info.expiresDate ?? renewal.gracePeriodExpiresDate ?? Date.now()),
      purchasedAt: info.purchaseDate ? new Date(info.purchaseDate) : null,
      raw: { notification: payload.notificationType, transaction: info, renewal },
    },
  };
}

export class AppleNotConfiguredError extends Error {
  constructor() {
    super("Apple 인앱결제가 아직 구성되지 않았습니다.");
    this.name = "AppleNotConfiguredError";
  }
}
