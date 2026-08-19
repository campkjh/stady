"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentFailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const message = params.get("message") || "결제가 취소되었거나 실패했어요.";

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={badgeStyle}>!</div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 900, color: "var(--c-text)" }}>결제가 완료되지 않았어요</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--c-text-3)", fontWeight: 600, lineHeight: 1.6 }}>{message}</p>
        <button type="button" style={primaryButtonStyle} onClick={() => router.push("/store/korean-history")}>
          다시 시도하기
        </button>
        <button type="button" style={ghostButtonStyle} onClick={() => router.push("/")}>
          홈으로
        </button>
      </div>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<main style={pageStyle} />}>
      <PaymentFailContent />
    </Suspense>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--c-bg)",
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

const badgeStyle = {
  width: 64,
  height: 64,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 32,
  fontWeight: 900,
  background: "var(--c-danger-soft)",
  color: "var(--c-danger-c)",
} as const;

const primaryButtonStyle = {
  width: "100%",
  marginTop: 12,
  border: "none",
  borderRadius: 14,
  background: "var(--c-brand)",
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
  color: "var(--c-text-3)",
  padding: "10px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
} as const;
