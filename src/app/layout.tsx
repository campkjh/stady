import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NativeAuthProvider } from "@/components/NativeAuthProvider";
import ThemeBoot from "@/components/ThemeBoot";
import PageViewTracker from "@/components/PageViewTracker";
import IapAutoRestore from "@/components/IapAutoRestore";
import NicknameGate from "@/components/NicknameGate";
import ReferralApply from "@/components/ReferralApply";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// viewport 는 반드시 이 export 로만 정의한다. <head> 에 <meta name="viewport"> 를 직접 쓰면
// Next 가 기본 viewport 메타(viewport-fit 없음)를 **하나 더** 뒤에 꽂아 뒤의 것이 이기고,
// viewport-fit=cover 가 무효가 되어 iOS 앱에서 env(safe-area-inset-*) 이 전부 0 이 된다.
// (이 때문에 34곳의 env() 패딩이 앱에서 전혀 동작하지 않고 있었다.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "스타디 - Stady",
  description: "학습 문제 풀이 플랫폼",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} h-full antialiased`}
      style={{ WebkitTextSizeAdjust: "100%" }}
      // data-theme 은 아래 인라인 스크립트가 첫 페인트 전에 붙인다(서버 HTML 엔 없음) → 하이드레이션 경고 억제
      suppressHydrationWarning
    >
      <head>
        {/* 라이트/다크 둘 다 지원함을 선언. 실제 색 스킴은 CSS(globals.css)의 color-scheme 이
            html[data-theme] 에 따라 light/dark 로 결정한다. 이 선언 + CSS color-scheme 덕분에
            안드로이드 WebView 의 강제 다크 변환(force-dark: 흰 카드를 멋대로 뒤집어 공지 팝업이
            안 보이던 문제)은 어느 테마에서도 걸리지 않는다. */}
        <meta name="color-scheme" content="light dark" />
        {/* 첫 페인트 전에 localStorage('stady-theme') 를 읽어 data-theme 을 세팅(깜빡임 방지).
            스크립트 본문은 반드시 dangerouslySetInnerHTML 로 넣는다 — children 문자열로 주면
            React 가 클라이언트 렌더 중 script 태그를 만나 "Encountered a script tag" 경고와
            하이드레이션 실패를 낸다(next/script beforeInteractive 로 감싸도 마찬가지였다). */}
        <script id="stady-theme-boot" dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col bg-white app-body"
        style={{
          width: "100%",
          margin: "0 auto",
          // clip: 가로 오버플로는 잘라내되 overflow-y가 auto로 강제되지 않아
          // body가 스크롤 컨테이너가 되지 않는다(홈 좌측 숏컷 position:sticky 유지).
          overflowX: "clip",
        }}
      >
        <ThemeBoot />
        {/* 페이지 체류 수집. (main) 그룹에만 두면 정작 오래 머무는 화면(문제풀이·모의고사·
            문제집·구독 등)이 그 레이아웃 밖이라 한 건도 안 잡힌다 — 반드시 루트에 둔다.
            /admin·/api 는 서버·클라이언트 양쪽에서 제외한다. */}
        <PageViewTracker />
        {/* 앱 실행 시 조용한 자동 구매복원 — 구글 검증 미구성 기간에 지급 안 된 안드
            결제분을, 사용자가 '구매 복원'을 누르지 않아도 앱만 켜면 살아나게 한다. */}
        <IapAutoRestore />
        {/* 닉네임이 다른 사용자와 중복이면 접속 시 강제 변경 팝업(닫기 없음). 신규 중복도 여기서 잡힌다. */}
        <NicknameGate />
        {/* 초대 링크로 들어와 가입한 경우, 저장된 초대코드를 서버에 보내 초대를 등록(한 번). */}
        <ReferralApply />
        <NativeAuthProvider>
          {children}
        </NativeAuthProvider>
      </body>
    </html>
  );
}
