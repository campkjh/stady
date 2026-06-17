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
