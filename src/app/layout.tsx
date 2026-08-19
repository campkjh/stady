import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NativeAuthProvider } from "@/components/NativeAuthProvider";
import ThemeBoot from "@/components/ThemeBoot";
import Script from "next/script";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 라이트/다크 둘 다 지원함을 선언. 실제 색 스킴은 CSS(globals.css)의 color-scheme 이
            html[data-theme] 에 따라 light/dark 로 결정한다. 이 선언 + CSS color-scheme 덕분에
            안드로이드 WebView 의 강제 다크 변환(force-dark: 흰 카드를 멋대로 뒤집어 공지 팝업이
            안 보이던 문제)은 어느 테마에서도 걸리지 않는다. */}
        <meta name="color-scheme" content="light dark" />
        {/* 첫 페인트 전에 localStorage('stady-theme') 를 읽어 data-theme 을 세팅(깜빡임 방지).
            raw <script> 를 <head> 에 두면 React 19 가 "Encountered a script tag" 경고를 낸다 —
            next/script beforeInteractive 가 같은 타이밍(하이드레이션 전)에 돌면서 경고가 없다. */}
        <Script id="stady-theme-boot" strategy="beforeInteractive">{THEME_BOOT_SCRIPT}</Script>
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
        <NativeAuthProvider>
          {children}
        </NativeAuthProvider>
      </body>
    </html>
  );
}
