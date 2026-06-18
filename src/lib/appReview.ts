// Review/rating bridges to the native app (App Store / Play Store).
// Two distinct flows, two distinct native handlers:
//  - requestReview  → opens the App Store "write a review" page (full review).
//                     Native iOS opens ?action=write-review via UIApplication.open.
//  - requestRating  → shows the in-app StoreKit star widget (rating only).
//                     Native iOS calls SKStoreReviewController.requestReview(in:).
// On web (no native bridge) both fall back to opening the store review page.

const IOS_REVIEW_URL = "https://apps.apple.com/kr/app/id6761746105?action=write-review";
const ANDROID_REVIEW_URL = "https://play.google.com/store/apps/details?id=kr.stady";
const APP_OPENED_KEY = "stady_app_opened_at";
const HOME_RATING_CALLED_KEY = "stady_home_rating_called"; // 이번 세션 중복 호출 방지용

// 리뷰 "작성" 페이지로 보낸다. (퀴즈 3문제 트리거에서 사용)
export function requestAppReview() {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  if (w.webkit?.messageHandlers?.requestReview) {
    w.webkit.messageHandlers.requestReview.postMessage({});
    return;
  }
  if (w.Android?.requestReview) {
    w.Android.requestReview();
    return;
  }
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  window.open(isAndroid ? ANDROID_REVIEW_URL : IOS_REVIEW_URL, "_blank", "noopener,noreferrer");
}

// StoreKit 별점 팝업(앱 안 별점 위젯)을 띄운다. (홈 3분 트리거에서 사용)
export function requestStarRating() {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  if (w.webkit?.messageHandlers?.requestRating) {
    w.webkit.messageHandlers.requestRating.postMessage({});
    return;
  }
  if (w.Android?.requestRating) {
    w.Android.requestRating();
    return;
  }
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  window.open(isAndroid ? ANDROID_REVIEW_URL : IOS_REVIEW_URL, "_blank", "noopener,noreferrer");
}

// 홈에서 "앱 사용 3분 뒤" 별점 팝업을 계정당 딱 1회만 띄우도록 예약한다.
// HomeClient의 useEffect에서 호출하고, 반환된 정리 함수를 cleanup으로 쓴다.
//  - 3분 기준점은 앱을 연 시각(sessionStorage)로 잡아, 홈을 떠났다 와도
//    누적 3분이 지나면 곧바로 뜬다.
//  - "1회만"은 서버(/api/home-rating, User.homeRatingPromptedAt)로 보장 → 계정 단위.
//    sessionStorage 플래그는 한 세션에서 서버를 중복 호출하지 않도록 막는 용도일 뿐.
export function scheduleHomeRatingOnce(): (() => void) | undefined {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(HOME_RATING_CALLED_KEY) === "1") return;

  const DELAY_MS = 3 * 60 * 1000;
  let openedAt = Number(sessionStorage.getItem(APP_OPENED_KEY));
  if (!openedAt) {
    openedAt = Date.now();
    sessionStorage.setItem(APP_OPENED_KEY, String(openedAt));
  }
  const remaining = Math.max(0, DELAY_MS - (Date.now() - openedAt));

  const timer = setTimeout(async () => {
    sessionStorage.setItem(HOME_RATING_CALLED_KEY, "1");
    try {
      const res = await fetch("/api/home-rating", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { prompt?: boolean };
      if (data.prompt) requestStarRating();
    } catch {
      // 네트워크 오류 시 조용히 무시 — 다음 세션에 다시 시도.
    }
  }, remaining);

  return () => clearTimeout(timer);
}

// 퀴즈(OX·영단어·워크북) 풀이 완료 직후 호출. 서버가 계정 단위로
// "임계치(3개) 이상 풀었고 아직 한 번도 안 띄웠는지"를 판정해주고, 그 경우에만
// 네이티브 리뷰 프롬프트를 띄운다. 계정당 평생 1회만 노출(아이폰/아이패드 공통).
export async function maybePromptAppReviewAfterQuiz() {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/app-review", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { prompt?: boolean };
    if (data.prompt) {
      // 결과 화면을 잠깐 본 뒤 자연스럽게 뜨도록 약간 지연.
      setTimeout(() => requestAppReview(), 1200);
    }
  } catch {
    // 네트워크 오류 시 조용히 무시 — 다음 풀이 때 다시 시도됨.
  }
}
