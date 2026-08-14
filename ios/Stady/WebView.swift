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

        // NOTE: 예전엔 여기서 매 실행마다 디스크/메모리 캐시를 통째로 지웠다
        // (WKWebsiteDataStore.removeData). "배포 후 옛 번들이 고착된다"는 이유였는데
        // 그 전제가 사실이 아니다 — stady.kr 문서 응답은
        //   cache-control: private, no-cache, no-store, max-age=0, must-revalidate
        // 라 HTML 은 애초에 캐시되지 않는다. 반대로 /_next/static/* 는 파일명에 해시가 박힌
        // immutable 자산이고 업로드 이미지(blob)는 1년 캐시라, 캐시를 지우면 실행할 때마다
        // JS 청크와 이미지를 전부 다시 받게 된다. 그래서 지우지 않는다.
        // 되돌리지 말 것 — 되돌리면 이미지 전송 비용이 그대로 되살아난다.

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // 최초 1회만 로드한다.
        // 예전엔 조건 없이 load() 를 불렀는데, SwiftUI 는 화면 회전·다크모드 전환·크기 변화
        // 같은 환경 변화에도 updateUIView 를 호출한다. 그때마다 stady.kr 이 통째로 리로드돼
        // 스크롤 위치는 물론 **작성 중이던 커뮤니티 글이 그대로 날아갔다**(웹 쪽에 임시저장이 없다).
        //
        // ⚠️ url 비교(webView.url != url)로 가드하면 안 된다. url 은 StadyApp.swift 의
        // 컴파일타임 상수라 절대 안 바뀌는 반면 webView.url 은 사용자가 이동할 때마다 바뀐다.
        // 그러면 "홈이 아닐 때 update 가 오면 홈으로 되돌린다"가 되어 더 나쁘다.
        // 그래서 Coordinator 에 1회성 플래그를 둔다.
        guard !context.coordinator.hasLoaded else { return }
        context.coordinator.hasLoaded = true
        // 기본 캐시 정책(useProtocolCachePolicy). HTML 은 no-store 라 항상 새로 받고,
        // 해시가 박힌 정적 자산과 이미지는 캐시를 그대로 활용한다.
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        // updateUIView 가 여러 번 불려도 최초 1회만 로드하기 위한 플래그.
        var hasLoaded = false

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
