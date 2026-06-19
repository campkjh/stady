import SwiftUI
import WebKit
import StoreKit

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // JS bridge: window.webkit.messageHandlers.requestReview.postMessage({})
        // triggers the native App Store rating prompt (StoreKit).
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
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "requestReview":
                requestNativeReview()
            default:
                break
            }
        }

        /// Shows the native in-app review prompt (App Store star rating).
        private func requestNativeReview() {
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
    }
}
