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

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK/10.0.0"
        // Enable the edge swipe-back gesture so users can navigate back from
        // pushed pages and external flows (e.g. the Toss billing/정기결제 page).
        webView.allowsBackForwardNavigationGestures = true
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
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
