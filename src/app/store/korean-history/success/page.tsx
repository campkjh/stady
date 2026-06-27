"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DOWNLOAD_PATH = "/api/downloads/korean-history";

type Status = "confirming" | "done" | "error";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("confirming");
  const [error, setError] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setError("결제 정보가 올바르지 않습니다.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "결제 승인에 실패했습니다.");
        setStatus("done");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "결제 승인에 실패했습니다.");
      }
    })();
  }, []);

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {status === "confirming" && (
          <>
            <div style={spinnerStyle} aria-hidden="true" />
            <h1 style={titleStyle}>결제를 확인하고 있어요</h1>
            <p style={descStyle}>잠시만 기다려 주세요...</p>
          </>
        )}

        {status === "done" && (
          <>
            <div style={{ ...badgeStyle, background: "#E8F5E9", color: "#16A34A" }}>✓</div>
            <h1 style={titleStyle}>결제가 완료되었어요!</h1>
            <p style={descStyle}>이제 2026 한국사 문제집을 다운로드할 수 있어요.</p>
            <a href={DOWNLOAD_PATH} style={{ ...primaryButtonStyle, textDecoration: "none", display: "block", textAlign: "center" }}>
              PDF 다운로드
            </a>
            <button type="button" style={ghostButtonStyle} onClick={() => router.push("/")}>
              홈으로
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ ...badgeStyle, background: "#FEF2F2", color: "#DC2626" }}>!</div>
            <h1 style={titleStyle}>결제 승인에 실패했어요</h1>
            <p style={descStyle}>{error}</p>
            <button type="button" style={primaryButtonStyle} onClick={() => router.push("/store/korean-history")}>
              다시 시도하기
            </button>
            <button type="button" style={ghostButtonStyle} onClick={() => router.push("/")}>
              홈으로
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes storeSpin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#fff",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
} as const;

const cardStyle = {
  width: "100%",
  display: "grid",
  gap: 12,
  justifyItems: "center",
  textAlign: "center",
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
  animation: "storeSpin 0.8s linear infinite",
} as const;

const primaryButtonStyle = {
  width: "100%",
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

const ghostButtonStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "#6B7280",
  padding: "10px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;
