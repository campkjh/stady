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

// 수집을 허용할 최상위 경로. 여기 없는 것은 버린다(오타·삭제된 화면·주입 시도).
// 새 화면을 만들면 여기에 한 줄 추가해야 통계에 잡힌다.
const ALLOWED_ROOTS = new Set([
  "bookmarks", "community", "history", "mypage", "search", "timer", "wrong-note",
  "category", "customer-center", "faq", "login", "mock-exam", "notice",
  "ox-quiz", "ox-quiz-intro", "vocab-quiz", "vocab-quiz-intro",
  "referral-event", "retest", "store", "subscribe", "withdraw", "workbook",
]);

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

    // 우리 화면에서 온 요청만 받는다(외부에서 긁어 넣는 것을 한 겹 더 막는다).
    // sendBeacon/fetch 는 Sec-Fetch-Site 를 붙인다. 헤더가 아예 없는 오래된 클라이언트는 통과시킨다.
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return OK();
    const { path, dwellMs, startedAt, visitId } = body as {
      path?: unknown;
      dwellMs?: unknown;
      startedAt?: unknown;
      visitId?: unknown;
    };

    // path 는 외부에서 아무 문자열이나 던질 수 있다. "/ 로 시작"만 보면 임의 경로를 무한히
    // 심어 어드민 인사이트 표를 통째로 밀어낼 수 있으므로, **아는 화면만** 받는다.
    if (typeof path !== "string" || !path.startsWith("/") || path.length > MAX_PATH_LENGTH) {
      return OK();
    }
    const head = path.split("?")[0].split("/")[1] ?? "";
    if (!(head === "" || ALLOWED_ROOTS.has(head))) return OK();

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

    const visit = typeof visitId === "string" && visitId.length > 0 && visitId.length <= 64 ? visitId : null;
    await recordPageView({ userId, path, dwellMs: dwell, startedAt: started, visitId: visit });
    return OK();
  } catch (error) {
    // 수집 실패가 사용자 화면에 영향을 주면 안 된다.
    console.error("PageView collect error:", error);
    return OK();
  }
}
