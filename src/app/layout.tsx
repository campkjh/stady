import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NativeAuthProvider } from "@/components/NativeAuthProvider";

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
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`} style={{ WebkitTextSizeAdjust: "100%" }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 안드로이드 다크 테마에서 WebView가 페이지를 자동으로 어둡게 뒤집는(force-dark)
            것을 막는다. 앱은 라이트 테마 하나로만 디자인돼 있어서, 자동 반전이 걸리면
            흰 카드가 딤과 비슷한 톤으로 어두워져 공지 팝업이 안 보이는 것처럼 된다. */}
        <meta name="color-scheme" content="light" />
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
        <NativeAuthProvider>
          {children}
        </NativeAuthProvider>
      </body>
    </html>
  );
}
