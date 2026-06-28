import SwiftUI
import WebKit
import StoreKit

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // JS 브리지 (web: src/lib/appReview.ts) — 두 흐름이 서로 다른 핸들러를 쓴다:
        //  - requestRating → 인앱 StoreKit 별점 위젯(SKStoreReviewController). 홈 3분 트리거.
        //  - requestReview → App Store "리뷰 작성" 페이지 열기. 퀴즈 3개 트리거.
        // 둘 다 등록해야 한다. (예전엔 requestReview만 등록 + StoreKit에 잘못 연결돼
        //  별점 위젯이 호출되는 requestRating을 아무도 못 받아 팝업이 안 떴음.)
        config.userContentController.add(context.coordinator, name: "requestRating")
        config.userContentController.add(context.coordinator, name: "requestReview")
        // NOTE: register the app's other handlers here too
        // (kakaoLogin / appleLogin / showNativeLogin).

        // The customUserAgent below is forced to an iPhone string (for KakaoTalk
        // login), which makes an iPad masquerade as a phone. The web layout can't
        // reliably recover the real device from a spoofed UA, so we hand it the
        // truth: inject the native interface idiom before any page script runs.
        // The web reads window.__STADY_NATIVE__.idiom (see src/lib/useIsTablet.ts).
        let idiom = UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"
        let idiomScript = WKUserScript(
            source: "window.__STADY_NATIVE__ = { idiom: \"\(idiom)\" };",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(idiomScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK/10.0.0"
        // Enable the edge swipe-back gesture so users can navigate back from
        // pushed pages and external flows (e.g. the Toss billing/정기결제 page).
        webView.allowsBackForwardNavigationGestures = true

        // Clear any stale cached web bundle on launch. WKWebView caches the HTML
        // document to disk (NSURLCache), so after a web (Vercel) deploy the app can
        // keep serving the OLD bundle — old JS chunks — even across full app
        // restarts; a normal relaunch does NOT clear this. Wipe the disk/memory
        // cache once at startup so the WebView always loads the latest deployed code.
        let cacheTypes: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]
        WKWebsiteDataStore.default().removeData(
            ofTypes: cacheTypes,
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) {}

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Bypass the local cache on every load so a fresh HTML document (and thus
        // the current JS chunk hashes) is always fetched after a deploy.
        // (URLRequest's cachePolicy initializer also requires timeoutInterval.)
        let request = URLRequest(
            url: url,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 60
        )
        webView.load(request)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        // 앱 스토어 ID(웹 src/lib/appReview.ts와 동일).
        private static let appStoreId = "6761746105"

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "requestRating":
                requestNativeRating()
            case "requestReview":
                openWriteReviewPage()
            default:
                break
            }
        }

        /// 인앱 StoreKit 별점 위젯(App Store 별점 팝업)을 띄운다.
        /// 주의: Apple이 노출을 제한한다 — TestFlight/디버그에선 안 뜨고,
        /// 프로덕션(App Store) 빌드에서 기기당 연 최대 3회만 노출된다.
        private func requestNativeRating() {
            DispatchQueue.main.async {
                if #available(iOS 14.0, *) {
                    if let scene = UIApplication.shared.connectedScenes
                        .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                        SKStoreReviewController.requestReview(in: scene)
                    }
                } else {
                    SKStoreReviewController.requestReview()
                }
            }
        }

        /// App Store "리뷰 작성" 페이지를 연다(전체 리뷰 작성용).
        private func openWriteReviewPage() {
            guard let url = URL(string: "https://apps.apple.com/app/id\(Coordinator.appStoreId)?action=write-review") else { return }
            DispatchQueue.main.async {
                UIApplication.shared.open(url)
            }
        }
    }
}
