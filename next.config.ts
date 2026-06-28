import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };
// 빌드(배포) 시점 날짜를 KST 기준 YYYY-MM-DD로 기록 → 마이홈 하단 "업데이트" 표기
const buildDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: pkg.version,
    BUILD_DATE: buildDate,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // 네비게이션 시 방문한 페이지를 클라이언트 캐시에 유지 → 탭을 오갈 때마다 서버에서
  // 다시 불러오지 않음. 동적 페이지(쿠키 사용) 기본값이 0초라 매번 재요청되던 문제 해결.
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
  // Bundle the paid PDF with the download route so it is readable at runtime
  // on Vercel. (The file under /private is gitignored; include it at deploy
  // time or swap the download route to Vercel Blob for production.)
  outputFileTracingIncludes: {
    "/api/downloads/korean-history": ["./private/**"],
  },
};

export default nextConfig;
