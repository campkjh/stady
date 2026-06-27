"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SubscriptionFailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const message = params.get("message") || "카드 등록이 취소되었거나 실패했어요.";

  // Back must return to 마이페이지, not the stale Toss billing page in history.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => router.replace("/mypage");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router]);

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={() => router.replace("/mypage")} aria-label="뒤로가기" style={backButtonStyle} className="press">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>정기결제</span>
      </header>

      <div style={contentStyle}>
        <div style={badgeStyle}>!</div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 900, color: "#111827" }}>구독을 시작하지 못했어요</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#6B7280", fontWeight: 600, lineHeight: 1.6 }}>{message}</p>
        <button type="button" style={primaryButtonStyle} onClick={() => router.replace("/mypage")}>
          마이페이지로
        </button>
      </div>
    </main>
  );
}

export default function SubscriptionFailPage() {
  return (
    <Suspense fallback={<main style={pageStyle} />}>
      <SubscriptionFailContent />
    </Suspense>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#fff",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: 56,
  padding: "0 8px",
  flexShrink: 0,
} as const;

const backButtonStyle = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
} as const;

const contentStyle = {
  flex: 1,
  display: "grid",
  gap: 12,
  justifyItems: "center",
  alignContent: "center",
  textAlign: "center",
  padding: 24,
} as const;

const badgeStyle = {
  width: 64,
  height: 64,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 32,
  fontWeight: 900,
  background: "#FEF2F2",
  color: "#DC2626",
} as const;

const primaryButtonStyle = {
  width: "100%",
  maxWidth: 320,
  marginTop: 12,
  border: "none",
  borderRadius: 14,
  background: "#3787FF",
  color: "#fff",
  padding: "15px 18px",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
} as const;
