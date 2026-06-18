// Triggers the native in-app review prompt (App Store / Play Store) through the
// WebView bridge. Falls back to opening the store's review page on web.
//
// Native side must implement:
//  - iOS: a WKScriptMessageHandler named "requestReview" calling
//    SKStoreReviewController.requestReview(in:)  (see ios/WebView.swift)
//  - Android: a JavascriptInterface named "Android" with requestReview()
//    using the Play In-App Review API (ReviewManager)

const IOS_REVIEW_URL = "https://apps.apple.com/kr/app/id6761746105?action=write-review";
const ANDROID_REVIEW_URL = "https://play.google.com/store/apps/details?id=kr.stady";

export function requestAppReview() {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  // iOS native in-app review (StoreKit)
  if (w.webkit?.messageHandlers?.requestReview) {
    w.webkit.messageHandlers.requestReview.postMessage({});
    return;
  }
  // Android native in-app review (Play Core)
  if (w.Android?.requestReview) {
    w.Android.requestReview();
    return;
  }
  // Web fallback: open the store review page
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  window.open(isAndroid ? ANDROID_REVIEW_URL : IOS_REVIEW_URL, "_blank", "noopener,noreferrer");
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
