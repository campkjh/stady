import { getCurrentUser } from "@/lib/auth";
import { MAX_DWELL_MS, MIN_DWELL_MS, recordPageView } from "@/lib/pageview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 페이지 체류 수집 엔드포인트.
// 클라이언트(PageViewTracker)가 경로를 떠날 때 sendBeacon 으로 1회 던진다.
// 언로드 중에 호출되므로 응답 본문은 쓰지 않고, 어떤 실패든 200 으로 닫는다
// (에러를 돌려주면 클라이언트가 재시도하거나 콘솔을 더럽힌다).
const MAX_PATH_LENGTH = 200;
const OK = () => new Response(null, { status: 200 });

export async function POST(request: Request) {
  try {
    // sendBeacon 은 Blob 으로 보내므로 text() 로 받아 직접 파싱한다.
    const raw = await request.text();
    if (!raw || raw.length > 2000) return OK();

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return OK();
    }
    if (!body || typeof body !== "object") return OK();
    const { path, dwellMs, startedAt } = body as {
      path?: unknown;
      dwellMs?: unknown;
      startedAt?: unknown;
    };

    // path: "/" 로 시작 + 200자 이하 (실제 [id] 정규화는 recordPageView 안에서)
    if (typeof path !== "string" || !path.startsWith("/") || path.length > MAX_PATH_LENGTH) {
      return OK();
    }

    // dwellMs: 3초 ~ 30분만 수용. 범위 밖은 조용히 버린다.
    const dwell = typeof dwellMs === "number" ? Math.round(dwellMs) : Number.NaN;
    if (!Number.isFinite(dwell) || dwell < MIN_DWELL_MS || dwell > MAX_DWELL_MS) return OK();

    // startedAt: 파싱 실패하거나 말이 안 되는 시각(미래/7일 초과 과거)이면 지금으로 대체.
    const now = Date.now();
    let started = typeof startedAt === "string" ? new Date(startedAt) : new Date(Number.NaN);
    const t = started.getTime();
    if (!Number.isFinite(t) || t > now + 60_000 || t < now - 7 * 24 * 60 * 60 * 1000) {
      started = new Date(now - dwell);
    }

    // 로그인 여부는 서버에서 판단. 비로그인이면 user_id NULL 로 기록한다.
    let userId: string | null = null;
    try {
      const user = await getCurrentUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    await recordPageView({ userId, path, dwellMs: dwell, startedAt: started });
    return OK();
  } catch (error) {
    // 수집 실패가 사용자 화면에 영향을 주면 안 된다.
    console.error("PageView collect error:", error);
    return OK();
  }
}
