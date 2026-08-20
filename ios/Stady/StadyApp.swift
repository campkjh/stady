import SwiftUI

@main
struct StadyApp: App {
    // 웹이 알려주는 현재 테마(라이트/다크). 웹뷰가 상태바 밑까지 깔리므로(엣지-투-엣지)
    // 상태바 글자색(시계·배터리)이 페이지와 겹친다 — preferredColorScheme 을 페이지 테마에
    // 맞춰야 "시스템 다크 + 앱 라이트"(흰 배경에 흰 시계) 같은 조합에서 시계가 안 보이는 일이 없다.
    @State private var webTheme: ColorScheme = .light

    var body: some Scene {
        WindowGroup {
            WebView(url: URL(string: "https://stady.kr")!, colorScheme: $webTheme)
                // 전체 화면을 채우고, 웹 CSS의 env(safe-area-inset-*)가 동작하도록
                // 세이프 영역까지 확장한다.
                .ignoresSafeArea()
                .preferredColorScheme(webTheme)
        }
    }
}
