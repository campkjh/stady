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
//   APPLE_BUNDLE_ID       — the app bundle id (com.stady.app)
//                           APPLE_IAP_BUNDLE_ID is accepted as an alias, see below.

const PROD_HOST = "https://api.storekit.itunes.apple.com";
const SANDBOX_HOST = "https://api.storekit-sandbox.itunes.apple.com";

/** 번들 id. 세 형제 키가 APPLE_IAP_* 라서 이것도 APPLE_IAP_BUNDLE_ID 로 넣기 쉬운데,
 *  그러면 appleConfigured() 가 false 가 되어 결제가 끝난 직후 503("인앱결제가 아직
 *  구성되지 않았습니다")만 뜬다 — 결제 화면에선 원인을 알 길이 없는 실패다.
 *  둘 다 받아 준다. */
function appleBundleId(): string | undefined {
  return process.env.APPLE_BUNDLE_ID || process.env.APPLE_IAP_BUNDLE_ID;
}

export function appleConfigured(): boolean {
  return !!(
    process.env.APPLE_IAP_ISSUER_ID &&
    process.env.APPLE_IAP_KEY_ID &&
    process.env.APPLE_IAP_PRIVATE_KEY &&
    appleBundleId()
  );
}

/** Apple(App Store Server API) 쪽에서 온 실패. `retryable` 이면 잠시 뒤 같은 요청이
 *  성공할 수 있다(샌드박스 색인 지연·5xx·네트워크). 라우트는 이걸 502 로 내보내
 *  클라이언트가 한 번 더 시도하게 한다. */
export class AppleUpstreamError extends Error {
  readonly retryable: boolean;
  readonly status: number;
  constructor(message: string, retryable: boolean, status = 0) {
    super(message);
    this.name = "AppleUpstreamError";
    this.retryable = retryable;
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const bundleId = appleBundleId()!;
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

/**
 * 결제 없이 APPLE_IAP_* 자격증명만 점검한다.
 *
 * 존재할 수 없는 거래 id 로 App Store Server API 를 한 번 호출해 상태 코드만 본다:
 *   401/403 → 키·issuer·bundleId·개인키 중 하나가 잘못됨(인증 실패)
 *   404/400 → 인증은 통과했고 "그런 거래가 없다"는 정상 응답 = 자격증명 정상
 * 샌드박스 실결제를 돌리지 않고도 검증 경로가 살아있는지 확인하려고 둔다.
 */
export async function appleCredentialSelfTest(): Promise<{
  configured: boolean;
  ok: boolean;
  detail: string;
  config?: { issuerId: string; keyId: string; bundleId: string; privateKeyHead: string };
  statuses?: Record<string, number>;
}> {
  if (!appleConfigured()) {
    const missing = [
      ["APPLE_IAP_ISSUER_ID", process.env.APPLE_IAP_ISSUER_ID],
      ["APPLE_IAP_KEY_ID", process.env.APPLE_IAP_KEY_ID],
      ["APPLE_IAP_PRIVATE_KEY", process.env.APPLE_IAP_PRIVATE_KEY],
      ["APPLE_BUNDLE_ID (또는 APPLE_IAP_BUNDLE_ID)", appleBundleId()],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    return { configured: false, ok: false, detail: `env 누락: ${missing.join(", ")}` };
  }

  // 401 을 만나면 "어느 값이 잘못됐나"를 ASC 화면과 눈으로 대조해야 한다. 개인키만
  // 빼고 실제 설정값을 돌려준다(앱 내 구입 키의 Issuer ID 는 App Store Connect API
  // 쪽 Issuer ID 와 다른데, 그걸 잘못 넣는 게 401 의 단골 원인이다).
  const privateKeyPem = process.env.APPLE_IAP_PRIVATE_KEY!.replace(/\\n/g, "\n").trim();
  const config = {
    issuerId: process.env.APPLE_IAP_ISSUER_ID!,
    keyId: process.env.APPLE_IAP_KEY_ID!,
    bundleId: appleBundleId()!,
    // 개인키는 첫 줄(헤더)만 — 형식이 깨졌는지만 보면 된다.
    privateKeyHead: `${privateKeyPem.split("\n")[0]} … (${privateKeyPem.length}자)`,
  };

  let token: string;
  try {
    token = appleAuthToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: true,
      ok: false,
      detail: `JWT 서명 실패 — APPLE_IAP_PRIVATE_KEY 형식(.p8 PEM) 확인: ${message}`,
      config,
    };
  }

  const statuses: Record<string, number> = {};
  for (const host of [PROD_HOST, SANDBOX_HOST]) {
    const label = host === SANDBOX_HOST ? "sandbox" : "production";
    try {
      const res = await fetch(`${host}/inApps/v1/transactions/0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      statuses[label] = res.status;
    } catch {
      statuses[label] = 0; // 네트워크 실패
    }
  }

  const authFailed = Object.values(statuses).every((s) => s === 401 || s === 403);
  return authFailed
    ? {
        configured: true,
        ok: false,
        detail:
          "Apple 인증 실패(401/403) — ISSUER_ID·KEY_ID·PRIVATE_KEY·BUNDLE_ID 중 하나가 잘못됐습니다. " +
          "특히 ISSUER_ID 는 App Store Connect API 쪽이 아니라 '앱 내 구입' 키 페이지에 표시된 값이어야 합니다.",
        config,
        statuses,
      }
    : {
        configured: true,
        ok: true,
        detail: "Apple 자격증명 정상 — 인증 통과(존재하지 않는 거래라 404/400은 정상 응답).",
        config,
        statuses,
      };
}

/** 샌드박스는 결제 직후 몇 초 동안 거래를 색인하지 못해 404 를 돌려준다. 한 번의
 *  404 를 "검증 실패"로 단정하면 이미 결제를 마친 사람에게 에러만 남으므로(App
 *  Review 2.1(b) 의 전형적인 모습) 짧게 여러 번 다시 물어본다. */
const APPLE_RETRY_DELAYS_MS = [600, 1800];

/** GET against the App Store Server API, trying the hinted environment first
 *  then the other (Apple recommends prod→sandbox fallback). Retries transient
 *  failures (404 indexing lag, 5xx, network) before giving up. */
async function appleGet(path: string, environmentHint?: "Production" | "Sandbox") {
  const token = appleAuthToken();
  const order: string[] =
    environmentHint === "Sandbox" ? [SANDBOX_HOST, PROD_HOST] : [PROD_HOST, SANDBOX_HOST];

  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 0; attempt <= APPLE_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(APPLE_RETRY_DELAYS_MS[attempt - 1]);
    for (const host of order) {
      let res: Response;
      try {
        res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        lastStatus = 0;
        lastDetail = error instanceof Error ? error.message : String(error);
        continue;
      }
      if (res.ok) {
        const env: "Production" | "Sandbox" = host === SANDBOX_HOST ? "Sandbox" : "Production";
        return { data: (await res.json()) as Record<string, unknown>, environment: env };
      }
      lastStatus = res.status;
      lastDetail = await res.text().catch(() => "");
      // 인증 실패는 재시도해도 그대로다 — 키 설정 문제이므로 즉시 중단한다.
      if (res.status === 401 || res.status === 403) {
        throw new AppleUpstreamError(
          `Apple 인증 실패(${res.status}) — APPLE_IAP_ISSUER_ID·KEY_ID·PRIVATE_KEY·BUNDLE_ID 확인 필요. ${lastDetail}`,
          false,
          res.status
        );
      }
      // 404 는 "다른 환경" 이거나 "아직 색인 전" — 다른 호스트/다음 시도로 넘어간다.
    }
  }
  throw new AppleUpstreamError(
    `Apple 거래 조회 실패(${lastStatus || "network"}) ${path}. ${lastDetail}`.trim(),
    true,
    lastStatus
  );
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
  //    여기서 실패해도 1)의 거래만으로 지급에 필요한 값(상품·만료·original id)은 이미
  //    갖고 있다. 이미 결제를 마친 사람을 이 부가 조회 하나 때문에 에러로 돌려보내지
  //    않는다 — 정확한 상태는 웹훅(ASSN)이 곧 덮어쓴다.
  let subResp: { data: Record<string, unknown> } | null = null;
  try {
    subResp = await appleGet(`/inApps/v1/subscriptions/${txn.originalTransactionId}`, environment);
  } catch (error) {
    console.error(
      "apple verify: subscription lookup failed, falling back to transaction info:",
      error instanceof Error ? error.message : error
    );
  }
  const groups = (subResp?.data.data as Array<Record<string, unknown>> | undefined) ?? [];
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

  // 부가 조회가 실패했으면 방금 애플이 확인해 준 거래를 그대로 유효한 구독으로 본다.
  if (statusCode === undefined && !subResp) statusCode = 1;

  const plan = planForProductId(latestTxn.productId);
  if (!plan) throw new Error(`알 수 없는 상품입니다: ${latestTxn.productId}`);

  const autoRenew = subResp ? renewal.autoRenewStatus === 1 : true;
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
