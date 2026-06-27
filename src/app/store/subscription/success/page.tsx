"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "confirming" | "done" | "error";

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("confirming");
  const [error, setError] = useState("");
  const [nextBillingAt, setNextBillingAt] = useState<string | null>(null);
  const ranRef = useRef(false);

  // Back from here must land on 마이페이지, never the now-stale Toss billing page
  // that sits in the history stack. Trap the back gesture and redirect.
  const goBack = () => router.replace("/mypage");
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => router.replace("/mypage");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const authKey = params.get("authKey");
    const customerKey = params.get("customerKey");
    const planId = params.get("planId") || "monthly-pass";

    if (!authKey || !customerKey) {
      setStatus("error");
      setError("결제 정보가 올바르지 않습니다.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/subscription/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authKey, customerKey, planId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "구독 처리에 실패했습니다.");
        setNextBillingAt(data.nextBillingAt || null);
        setStatus("done");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "구독 처리에 실패했습니다.");
      }
    })();
  }, []);

  const nextDate = nextBillingAt ? new Date(nextBillingAt).toLocaleDateString("ko-KR") : null;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={goBack} aria-label="뒤로가기" style={backButtonStyle} className="press">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>정기결제</span>
      </header>

      <div style={contentStyle}>
        {status === "confirming" && (
          <>
            <div style={spinnerStyle} aria-hidden="true" />
            <h1 style={titleStyle}>구독을 처리하고 있어요</h1>
            <p style={descStyle}>잠시만 기다려 주세요...</p>
          </>
        )}

        {status === "done" && (
          <>
            <div style={{ ...badgeStyle, background: "#E8F5E9", color: "#16A34A" }}>✓</div>
            <h1 style={titleStyle}>월정액 패키지 구독 완료!</h1>
            <p style={descStyle}>
              이제 월정액 혜택을 이용할 수 있어요.
              {nextDate ? ` 다음 결제일은 ${nextDate}입니다.` : ""}
            </p>
            <button type="button" style={primaryButtonStyle} onClick={() => router.replace("/mypage")}>
              마이페이지로
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ ...badgeStyle, background: "#FEF2F2", color: "#DC2626" }}>!</div>
            <h1 style={titleStyle}>구독에 실패했어요</h1>
            <p style={descStyle}>{error}</p>
            <button type="button" style={primaryButtonStyle} onClick={() => router.replace("/mypage")}>
              마이페이지로
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes subSpin { to { transform: rotate(360deg); } }`}</style>
    </main>
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

const titleStyle = { margin: "8px 0 0", fontSize: 22, fontWeight: 900, color: "#111827" } as const;
const descStyle = { margin: 0, fontSize: 14, color: "#6B7280", fontWeight: 600, lineHeight: 1.6 } as const;

const badgeStyle = {
  width: 64,
  height: 64,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 32,
  fontWeight: 900,
} as const;

const spinnerStyle = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "4px solid #E5E7EB",
  borderTopColor: "#3787FF",
  animation: "subSpin 0.8s linear infinite",
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
