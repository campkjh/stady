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
