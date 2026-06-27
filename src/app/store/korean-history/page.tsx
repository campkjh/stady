"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const PRODUCT_ID = "korean-history-2026";
const PRODUCT_TITLE = "2026 한국사";
const PRODUCT_SUBTITLE = "한국사 문제집 PDF";
const PRICE = 3900;
const DOWNLOAD_PATH = "/api/downloads/korean-history";

export default function KoreanHistoryStorePage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/status?productId=${PRODUCT_ID}`, { credentials: "include" });
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
      setPurchased(Boolean(data.purchased));
    } catch {
      setError("상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handlePurchase() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: PRODUCT_ID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결제 준비에 실패했습니다.");

      const tossPayments = await loadTossPayments(data.clientKey);
      const payment = tossPayments.payment({ customerKey: data.customerKey });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: data.amount },
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: `${window.location.origin}/store/korean-history/success`,
        failUrl: `${window.location.origin}/store/korean-history/fail`,
        customerEmail: data.customerEmail || undefined,
        customerName: data.customerName || undefined,
      });
      // requestPayment redirects on success; if it returns, nothing else to do.
    } catch (e) {
      const message = e instanceof Error ? e.message : "결제를 진행하지 못했습니다.";
      // User-cancelled the payment window — don't surface as a scary error.
      if (!/취소|cancel/i.test(message)) setError(message);
      setBusy(false);
    }
  }

  return (
    <main style={pageStyle}>
      <header style={topbarStyle}>
        <button type="button" onClick={() => router.push("/")} aria-label="뒤로가기" style={backButtonStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>교재 구매</h1>
      </header>

      <div style={{ padding: "16px 18px 28px" }}>
        <div style={coverStyle}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.82)", letterSpacing: 1 }}>STADY</span>
          <span style={{ fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginTop: 8 }}>2026<br />한국사</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginTop: 10 }}>문제집 · PDF</span>
        </div>

        <h2 style={{ margin: "20px 0 4px", fontSize: 22, fontWeight: 900, color: "#111827" }}>{PRODUCT_TITLE}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#6B7280", fontWeight: 600 }}>{PRODUCT_SUBTITLE}</p>

        <div style={priceRowStyle}>
          <span style={{ fontSize: 14, color: "#6B7280", fontWeight: 700 }}>판매가</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>{PRICE.toLocaleString()}원</span>
        </div>

        <ul style={infoListStyle}>
          <li>결제 완료 후 곧바로 PDF를 다운로드할 수 있어요.</li>
          <li>구매 내역은 계정에 저장되어 언제든 다시 받을 수 있어요.</li>
          <li>디지털 상품 특성상 결제 후 단순 변심 환불은 어려울 수 있어요.</li>
        </ul>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <div style={{ marginTop: 22 }}>
          {loading ? (
            <button type="button" style={{ ...primaryButtonStyle, opacity: 0.6 }} disabled>
              불러오는 중...
            </button>
          ) : !authenticated ? (
            <button type="button" style={primaryButtonStyle} onClick={() => router.push("/login")}>
              로그인하고 구매하기
            </button>
          ) : purchased ? (
            <a href={DOWNLOAD_PATH} style={{ ...primaryButtonStyle, display: "block", textAlign: "center", textDecoration: "none" }}>
              PDF 다운로드
            </a>
          ) : (
            <button type="button" style={{ ...primaryButtonStyle, opacity: busy ? 0.6 : 1 }} onClick={handlePurchase} disabled={busy}>
              {busy ? "결제창을 여는 중..." : `${PRICE.toLocaleString()}원 결제하고 다운로드`}
            </button>
          )}
        </div>

        {authenticated && purchased && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#16A34A", fontWeight: 700, textAlign: "center" }}>
            이미 구매한 교재입니다. 위 버튼으로 다시 받을 수 있어요.
          </p>
        )}
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#fff",
  maxWidth: 720,
  margin: "0 auto",
} as const;

const topbarStyle = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px 12px",
  background: "rgba(255,255,255,0.9)",
  borderBottom: "1px solid #F1F3F5",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
} as const;

const backButtonStyle = {
  width: 38,
  height: 38,
  border: "1px solid #E5E7EB",
  borderRadius: 999,
  background: "#fff",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

const coverStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  aspectRatio: "3 / 2",
  borderRadius: 18,
  background: "linear-gradient(135deg, #3787FF, #1E5FD8)",
  padding: "22px 24px",
  boxShadow: "0 16px 36px rgba(55,135,255,0.28)",
} as const;

const priceRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #F1F3F5",
} as const;

const infoListStyle = {
  margin: "18px 0 0",
  padding: "16px 18px",
  background: "#F8FAFC",
  borderRadius: 12,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.9,
  fontWeight: 600,
} as const;

const errorBoxStyle = {
  marginTop: 16,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#DC2626",
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
  fontWeight: 700,
} as const;

const primaryButtonStyle = {
  width: "100%",
  border: "none",
  borderRadius: 14,
  background: "#3787FF",
  color: "#fff",
  padding: "16px 18px",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
} as const;
