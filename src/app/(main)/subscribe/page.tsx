"use client";

import { useState } from "react";
import { useIap, type IapPlanView } from "@/lib/iap/client";

const won = (n: number) => n.toLocaleString("ko-KR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

const FREE_FEATURES = [
  { label: "영단어·사탐 OX 퀴즈 일부 이용", on: true },
  { label: "커뮤니티·타이머 자유 이용", on: true },
  { label: "전체 문항·전 챕터 이용", on: false },
  { label: "모의고사(태블릿) 전체 회차", on: false },
  { label: "해설·책갈피 무제한 저장", on: false },
];

const PREMIUM_FEATURES = [
  "전 과목 OX 퀴즈 전 문항 무제한",
  "영단어 전체 세트 무제한",
  "모의고사(태블릿) 전체 회차 이용",
  "전체 해설·책갈피 무제한 저장",
];

export default function SubscribePage() {
  const { inApp, plans, entitlement, loading, busy, purchase, restore } = useIap();
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(planId: IapPlanView["id"]) {
    setError(null);
    try {
      await purchase(planId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제를 시작하지 못했어요.");
    }
  }

  async function handleRestore() {
    setError(null);
    try {
      await restore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "구매 복원에 실패했어요.");
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#8B95A1" }}>불러오는 중…</div>;
  }

  const active = entitlement?.active;
  const activePlan = active ? plans.find((p) => p.id === entitlement?.planId) : null;

  return (
    <div style={{ background: "#F9FAFB", minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ padding: "28px 20px 8px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.5px", color: "#191F28" }}>
          <span style={{ color: "#3182F6" }}>스타디</span> 프리미엄 구독
        </h1>
        <p style={{ fontSize: 14.5, color: "#8B95A1", margin: "8px 0 0", fontWeight: 500 }}>
          1등급을 위한 학습자료를 제한 없이 이용하세요.
        </p>
      </div>

      {/* 현재 구독 상태 */}
      {active && (
        <div style={{ margin: "12px 20px", padding: "14px 16px", background: "#EAF3FF", borderRadius: 12, border: "1px solid #CFE3FF" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1B64DA" }}>
            {activePlan?.name ?? "프리미엄"} 이용 중
            {entitlement?.status === "CANCELED" ? " · 해지 예약됨" : ""}
          </div>
          {entitlement?.expiresAt && (
            <div style={{ fontSize: 13, color: "#4E5968", marginTop: 4 }}>
              {entitlement.autoRenew ? "다음 갱신일" : "이용 종료일"} {fmtDate(entitlement.expiresAt)}
            </div>
          )}
        </div>
      )}

      {/* 요금제 카드 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 20px 4px" }}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={active && entitlement?.planId === plan.id}
            disabled={busy || (active ?? false)}
            inApp={inApp}
            onBuy={() => handleBuy(plan.id)}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: "#E5484D", fontSize: 13.5, textAlign: "center", margin: "10px 20px 0" }}>{error}</p>
      )}

      {!inApp && (
        <p style={{ fontSize: 13, color: "#8B95A1", textAlign: "center", margin: "14px 20px 0", lineHeight: 1.6 }}>
          구독 결제는 <b>스타디 앱</b>에서 진행할 수 있어요.<br />앱을 설치한 뒤 마이페이지에서 구독해 주세요.
        </p>
      )}

      {inApp && (
        <button
          type="button"
          onClick={handleRestore}
          disabled={busy}
          style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: "#8B95A1", fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
        >
          구매 복원
        </button>
      )}

      {/* FREE vs PREMIUM 비교 */}
      <div style={{ padding: "26px 20px 0" }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 14px", color: "#191F28" }}>
          구독모드와 일반모드는 무엇이 다른가요?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#F2F4F6", borderRadius: 16, padding: "18px 16px" }}>
            <span style={badge("#8B95A1")}>FREE</span>
            <div style={{ fontSize: 16, fontWeight: 800, margin: "12px 0 2px", color: "#191F28" }}>일반 모드</div>
            <div style={{ fontSize: 13, color: "#8B95A1", marginBottom: 12 }}>0원</div>
            {FREE_FEATURES.map((f) => (
              <FeatureRow key={f.label} label={f.label} on={f.on} />
            ))}
          </div>
          <div style={{ background: "#0B1B34", borderRadius: 16, padding: "18px 16px", border: "1.5px solid #3182F6" }}>
            <span style={badge("#3182F6")}>PREMIUM</span>
            <div style={{ fontSize: 16, fontWeight: 800, margin: "12px 0 2px", color: "#fff" }}>프리미엄 구독</div>
            <div style={{ fontSize: 13, color: "#7FB2FF", marginBottom: 12 }}>월 구독</div>
            {PREMIUM_FEATURES.map((label) => (
              <FeatureRow key={label} label={label} on dark />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  disabled,
  inApp,
  onBuy,
}: {
  plan: IapPlanView;
  current: boolean | undefined;
  disabled: boolean;
  inApp: boolean;
  onBuy: () => void;
}) {
  const isAnnual = plan.period === "year";
  return (
    <div
      style={{
        background: plan.recommended ? "#0B1B34" : "#fff",
        borderRadius: 16,
        padding: "18px 18px 16px",
        border: plan.recommended ? "1.5px solid #3182F6" : "1px solid #E5E8EB",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16.5, fontWeight: 800, color: plan.recommended ? "#fff" : "#191F28" }}>
          {plan.name}
        </span>
        {plan.badge && <span style={badge("#3182F6")}>{plan.badge}</span>}
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: plan.recommended ? "#fff" : "#191F28" }}>
          {won(plan.monthlyEquivalentKrw)}원
        </span>
        <span style={{ fontSize: 14, color: plan.recommended ? "#9DB6DD" : "#8B95A1" }}>/월</span>
      </div>
      <div style={{ fontSize: 13, color: plan.recommended ? "#9DB6DD" : "#8B95A1", marginTop: 4 }}>
        {isAnnual ? `연 ${won(plan.priceKrw)}원 결제 · ${plan.tagline}` : plan.tagline}
      </div>
      <button
        type="button"
        onClick={onBuy}
        disabled={disabled || !inApp}
        className="press"
        style={{
          marginTop: 14,
          width: "100%",
          border: "none",
          borderRadius: 10,
          background: current ? "#3F4B5C" : plan.recommended ? "#3182F6" : "#191F28",
          color: "#fff",
          padding: "12px 0",
          fontSize: 14.5,
          fontWeight: 700,
          cursor: disabled || !inApp ? "default" : "pointer",
          opacity: disabled || !inApp ? 0.55 : 1,
        }}
      >
        {current ? "이용 중" : !inApp ? "앱에서 구독하기" : "구독하기"}
      </button>
    </div>
  );
}

function FeatureRow({ label, on, dark }: { label: string; on: boolean; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: on ? "#3182F6" : dark ? "#334155" : "#D1D6DB",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {on ? "✓" : "✕"}
      </span>
      <span style={{ fontSize: 12.5, lineHeight: 1.4, color: on ? (dark ? "#DDE6F2" : "#4E5968") : dark ? "#64748B" : "#B0B8C1" }}>
        {label}
      </span>
    </div>
  );
}

function badge(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: color,
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.3px",
  };
}
