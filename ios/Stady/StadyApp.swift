import SwiftUI

@main
struct StadyApp: App {
    var body: some Scene {
        WindowGroup {
            WebView(url: URL(string: "https://stady.kr")!)
                // 전체 화면을 채우고, 웹 CSS의 env(safe-area-inset-*)가 동작하도록
                // 세이프 영역까지 확장한다.
                .ignoresSafeArea()
        }
    }
}
