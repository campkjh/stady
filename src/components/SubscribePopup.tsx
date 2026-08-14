"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIap, detectPlatform } from "@/lib/iap/client";
import type { PlanId } from "@/lib/iap/types";

// 스타디 프리미엄 구독 팝업.
//
// NoticePopup 과 동일한 "body 포털 + position:fixed + top/right/bottom/left" 패턴을
// 그대로 따른다(네비게이션바/헤더 위에 뜨게, 안드로이드 웹뷰 렌더 함정 회피):
//   - document.body 포털(조상 transform/overflow 로 fixed 가 갇히는 것 방지)
//   - inset 단축 대신 top/right/bottom/left, 등장 애니메이션 없음
//   - z-index 는 네비(2000 미만)보다 확실히 위
//
// 상태: (1) 미구독 → 좌 월간 / 우 수능 선택 + 공통 혜택 하단, (2) 구독중 → 관리·해지.
// IAP 특성상 실제 해지는 스토어 구독관리로 연결(앱 API 로 취소 불가), 리텐션 없이 깔끔하게.

const won = (n: number) => n.toLocaleString("ko-KR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

// 두 플랜 공통 혜택 — 앱 아이콘 활용.
const BENEFITS = [
  { icon: "/icons/daily-ox-quiz.svg", label: "전 과목 OX 퀴즈 전 문항 무제한" },
  { icon: "/icons/english.svg", label: "영단어 전체 세트 무제한" },
  { icon: "/icons/banner-mock.svg", label: "모의고사(태블릿) 전체 회차 이용" },
  { icon: "/icons/nav-bookmark.svg", label: "전체 해설 · 책갈피 무제한 저장" },
];

const STORE_MANAGE_URL: Record<string, string> = {
  apple: "https://apps.apple.com/account/subscriptions",
  google: "https://play.google.com/store/account/subscriptions",
};

export default function SubscribePopup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { inApp, plans, entitlement, loading, busy, purchase, restore, refresh } = useIap();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<PlanId>("suneung_annual"); // 기본: 더 저렴한 연구독
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) { setError(null); refresh(); }
  }, [open, refresh]);

  if (!mounted || !open) return null;

  const monthly = plans.find((p) => p.id === "monthly");
  const annual = plans.find((p) => p.id === "suneung_annual");
  const active = entitlement?.active;

  async function handleBuy() {
    setError(null);
    try {
      await purchase(selected);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  function openStoreManage() {
    const platform = entitlement?.platform || detectPlatform() || "apple";
    const url = STORE_MANAGE_URL[platform] || STORE_MANAGE_URL.apple;
    // 스토어 구독관리(iOS=App Store, Android=Play)로 이동 → 거기서 해지.
    window.location.href = url;
  }

  function handleCancel() {
    // 리텐션 없이 바로: 한 번만 확인하고 스토어 구독관리로 보낸다.
    const ok = window.confirm(
      "구독을 해지하시겠어요?\n남은 이용 기간까지는 그대로 이용할 수 있어요."
    );
    if (ok) openStoreManage();
  }

  // 월간 대비 절약액(수능 연구독 강조용)
  const savePerMonth =
    monthly && annual ? monthly.monthlyEquivalentKrw - annual.monthlyEquivalentKrw : 0;

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 100000,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: "92%",
          background: "#fff",
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{ position: "relative", padding: "22px 20px 6px", textAlign: "center", flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, border: "none", background: "#F2F4F6", borderRadius: "50%", color: "#8B95A1", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/answer-king-crown.svg" alt="" style={{ width: 46, height: 46, margin: "0 auto 8px", display: "block" }} />
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#191F28", letterSpacing: "-0.4px" }}>
            <span style={{ color: "#3182F6" }}>스타디</span> 프리미엄
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#8B95A1", fontWeight: 500 }}>
            1등급을 위한 학습자료를 제한 없이
          </p>
        </div>

        <div style={{ overflowY: "auto", padding: "10px 20px 0", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8B95A1" }}>불러오는 중…</div>
          ) : active ? (
            <ActiveState entitlement={entitlement!} plans={plans} />
          ) : (
            <>
              {/* 좌 월간 / 우 수능 선택 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {monthly && (
                  <PlanCard
                    plan={monthly}
                    selected={selected === "monthly"}
                    onSelect={() => setSelected("monthly")}
                    subLabel="매월 결제"
                  />
                )}
                {annual && (
                  <PlanCard
                    plan={annual}
                    selected={selected === "suneung_annual"}
                    onSelect={() => setSelected("suneung_annual")}
                    subLabel={`연 ${won(annual.priceKrw)}원`}
                    badge={annual.discountPct ? `${annual.discountPct}% 할인` : "가장 저렴"}
                    highlight={savePerMonth > 0 ? `월 ${won(savePerMonth)}원 아껴요` : undefined}
                  />
                )}
              </div>

              {/* 공통 혜택 */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8B95A1", marginBottom: 10, letterSpacing: "-0.2px" }}>
                  두 플랜 모두 이런 혜택을 드려요
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {BENEFITS.map((b) => (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: "#F2F7FF", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.icon} alt="" style={{ width: 20, height: 20 }} />
                      </span>
                      <span style={{ fontSize: 14, color: "#333D4B", fontWeight: 600, lineHeight: 1.35 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 CTA */}
        {!loading && (
          <div style={{ padding: "14px 20px calc(14px + env(safe-area-inset-bottom))", flexShrink: 0 }}>
            {error && (
              <p style={{ color: "#E5484D", fontSize: 13, textAlign: "center", margin: "0 0 10px" }}>{error}</p>
            )}
            {active ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                style={ctaStyle("#F2F4F6", "#4E5968", busy)}
              >
                구독 해지
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={busy}
                  className="press"
                  style={ctaStyle("#3182F6", "#fff", busy)}
                >
                  {busy
                    ? "처리 중…"
                    : `${plans.find((p) => p.id === selected)?.name ?? "구독"} 시작하기`}
                </button>
                {inApp && (
                  <button
                    type="button"
                    onClick={() => restore().catch(() => {})}
                    disabled={busy}
                    style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "#8B95A1", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
                  >
                    구매 복원
                  </button>
                )}
                {!inApp && (
                  <p style={{ fontSize: 12, color: "#B0B8C1", textAlign: "center", margin: "9px 0 0", lineHeight: 1.5 }}>
                    구독 결제는 스타디 앱에서 진행할 수 있어요
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function PlanCard({
  plan,
  selected,
  onSelect,
  subLabel,
  badge,
  highlight,
}: {
  plan: { id: PlanId; name: string; monthlyEquivalentKrw: number };
  selected: boolean;
  onSelect: () => void;
  subLabel: string;
  badge?: string;
  highlight?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="press"
      style={{
        position: "relative",
        textAlign: "left",
        border: selected ? "2px solid #3182F6" : "2px solid #E5E8EB",
        background: selected ? "#F4F8FF" : "#fff",
        borderRadius: 16,
        padding: "16px 14px 14px",
        cursor: "pointer",
        transition: "border-color .12s, background .12s",
      }}
    >
      {badge && (
        <span style={{ position: "absolute", top: -9, left: 12, background: "#3182F6", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999 }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#191F28" }}>{plan.name}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: selected ? "#1B64DA" : "#191F28" }}>
          {won(plan.monthlyEquivalentKrw)}
        </span>
        <span style={{ fontSize: 13, color: "#8B95A1", fontWeight: 700 }}>원/월</span>
      </div>
      <div style={{ fontSize: 12, color: "#8B95A1", marginTop: 3 }}>{subLabel}</div>
      {highlight && (
        <div style={{ marginTop: 9, fontSize: 11.5, fontWeight: 800, color: "#1B64DA", background: "#E4EEFF", borderRadius: 7, padding: "4px 7px", display: "inline-block" }}>
          {highlight}
        </div>
      )}
    </button>
  );
}

function ActiveState({
  entitlement,
  plans,
}: {
  entitlement: NonNullable<ReturnType<typeof useIap>["entitlement"]>;
  plans: ReturnType<typeof useIap>["plans"];
}) {
  const planName = plans.find((p) => p.id === entitlement.planId)?.name ?? "프리미엄";
  const canceled = entitlement.status === "CANCELED";
  return (
    <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
      <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#EAF3FF", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/book-laurel-gold.svg" alt="" style={{ width: 34, height: 34 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#191F28" }}>{planName} 이용 중</div>
      {entitlement.expiresAt && (
        <div style={{ fontSize: 13.5, color: "#6B7280", marginTop: 6 }}>
          {canceled ? "이용 종료일" : entitlement.autoRenew ? "다음 갱신일" : "이용 종료일"} {fmtDate(entitlement.expiresAt)}
        </div>
      )}
      <div style={{ marginTop: 16, background: "#F9FAFB", borderRadius: 14, padding: "14px 16px", textAlign: "left" }}>
        {BENEFITS.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
            <span style={{ color: "#3182F6", fontWeight: 900, fontSize: 13 }}>✓</span>
            <span style={{ fontSize: 13.5, color: "#4E5968", fontWeight: 600 }}>{b.label}</span>
          </div>
        ))}
      </div>
      {canceled && (
        <p style={{ fontSize: 12.5, color: "#8B95A1", marginTop: 12 }}>해지 예약됨 · 위 종료일까지 이용할 수 있어요</p>
      )}
    </div>
  );
}

function ctaStyle(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: "none",
    borderRadius: 14,
    background: bg,
    color,
    padding: "15px 0",
    fontSize: 15.5,
    fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
