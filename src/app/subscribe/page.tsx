"use client";

import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import { useIap, detectPlatform } from "@/lib/iap/client";
import type { PlanId } from "@/lib/iap/types";

// 스타디 프리미엄 — 페이지판.
// 예전엔 마이페이지에서 팝업(SubscribePopup)으로 띄웠는데, 결제 흐름을 한 화면에서 차분히
// 보게 하려고 페이지로 옮겼다. 상태/로직은 팝업과 동일:
//   (1) 미구독 → 좌 월간 / 우 수능 선택 + 공통 혜택 + 시작하기
//   (2) 구독중 → 관리·해지(IAP 는 스토어 구독관리로 연결, 앱 API 로 취소 불가)
// (main) 그룹 밖에 두어 하단 네비게이션 없이 뜬다(결제 화면은 단독). 아이콘은 /public/icons/premium/.

const won = (n: number) => n.toLocaleString("ko-KR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

const BENEFITS = [
  { icon: "/icons/premium/ox-quiz.svg", label: "전 과목 OX 퀴즈 전 문항 무제한" },
  { icon: "/icons/premium/ab-tab.svg", label: "영단어 전체 세트 무제한" },
  { icon: "/icons/premium/pencil.svg", label: "모의고사 전체 회차 · 문항 풀이" },
  { icon: "/icons/premium/bookmark.svg", label: "전체 해설 · 책갈피 무제한 저장" },
];

const STORE_MANAGE_URL: Record<string, string> = {
  apple: "https://apps.apple.com/account/subscriptions",
  google: "https://play.google.com/store/account/subscriptions",
};

// 앱 심사(3.1.2c) 필수: 구매 화면에 이용약관(EULA)·개인정보처리방침 "동작하는 링크"가
// 있어야 한다. iOS는 표준 Apple EULA를 쓰므로 그 링크를, 그 외엔 자체 약관을 연다.
const APPLE_STD_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "/mypage/terms/privacy";

export default function SubscribePage() {
  const { inApp, plans, entitlement, authenticated, loading, busy, purchase, restore, refresh } = useIap();
  const [selected, setSelected] = useState<PlanId>("suneung_annual"); // 기본: 더 저렴한 연구독
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const monthly = plans.find((p) => p.id === "monthly");
  const annual = plans.find((p) => p.id === "suneung_annual");
  const active = entitlement?.active;

  async function handleBuy() {
    setError(null);
    try {
      await purchase(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function openStoreManage() {
    const platform = entitlement?.platform || detectPlatform() || "apple";
    window.location.href = STORE_MANAGE_URL[platform] || STORE_MANAGE_URL.apple;
  }

  // 확인은 인앱 모달에서 받는다(iOS WKWebView는 window.confirm이 동작하지 않아
  // 버튼이 아무 반응 없는 것처럼 보였다 — 책갈피 페이지와 같은 패턴).
  function handleCancel() {
    setShowCancelConfirm(true);
  }

  const savePerMonth =
    monthly && annual ? monthly.monthlyEquivalentKrw - annual.monthlyEquivalentKrw : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
      <BackHeader title="스타디 프리미엄" />

      <div style={{ flex: 1, padding: "8px 20px 0", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* 헤더 */}
        <div style={{ textAlign: "center", padding: "26px 0 6px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* SVG 는 배경이 투명이라 다크에서 타일이 사라진다 → 앱 아이콘 본래의 흰 타일을 명시(두 테마 동일). */}
          <img src="/icons/stady-app-icon.svg" alt="스타디" style={{ width: 72, height: 72, borderRadius: 20, display: "block", margin: "0 auto 12px", background: "#fff", boxShadow: "0 6px 18px rgba(49,130,246,0.18)" }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--c-text-b)", letterSpacing: "-0.5px" }}>
            <span style={{ color: "var(--c-brand-b)" }}>스타디</span> 프리미엄
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--c-text-4b)", fontWeight: 500 }}>
            1등급을 위한 학습자료를 제한 없이
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-4b)" }}>불러오는 중…</div>
        ) : active ? (
          <ActiveState entitlement={entitlement!} plans={plans} />
        ) : (
          <>
            {/* 좌 월간 / 우 수능 선택 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              {monthly && (
                <PlanCard
                  plan={monthly}
                  selected={selected === "monthly"}
                  onSelect={() => setSelected("monthly")}
                  subLabel="1개월 구독 · 매월 결제"
                />
              )}
              {annual && (
                <PlanCard
                  plan={annual}
                  selected={selected === "suneung_annual"}
                  onSelect={() => setSelected("suneung_annual")}
                  subLabel={`1년 구독 · 월 ${won(annual.monthlyEquivalentKrw)}원 꼴`}
                  badge={annual.discountPct ? `${annual.discountPct}% 할인` : "가장 저렴"}
                  highlight={savePerMonth > 0 ? `월 ${won(savePerMonth)}원 아껴요` : undefined}
                />
              )}
            </div>

            {/* 공통 혜택 */}
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--c-text-4b)", marginBottom: 12, letterSpacing: "-0.2px" }}>
                두 플랜 모두 이런 혜택을 드려요
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {BENEFITS.map((b, i) => (
                  // 아래에서 위로 차례로 떠오르고, 자리 잡을 때 테두리를 은은한 프리즘 빛이
                  // 한 바퀴 감싸고 사라진다(각도 회전 그라디언트 → 마스크로 테두리만 남김).
                  <div key={b.label} className="benefit-row" style={{ animationDelay: `${160 + i * 180}ms` }}>
                    <span className="benefit-prism" aria-hidden="true" style={{ "--d": `${160 + i * 180 + 600}ms` } as React.CSSProperties} />
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--c-brand-soft-7)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.icon} alt="" style={{ width: 24, height: 24 }} />
                    </span>
                    <span style={{ fontSize: 15, color: "var(--c-text-2b)", fontWeight: 600, lineHeight: 1.35 }}>{b.label}</span>
                  </div>
                ))}
              </div>
              <BenefitStyles />
            </div>
          </>
        )}
      </div>

      {/* 하단 CTA — 이 페이지는 (main) 그룹 밖이라 하단 네비가 없다. 뷰포트 하단에 붙인다. */}
      {!loading && (
        <div style={{ position: "sticky", bottom: 0, background: "var(--c-bg)", borderTop: "1px solid var(--c-bg-muted-2)", padding: "14px 20px calc(14px + env(safe-area-inset-bottom, 0px))", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {error && (
            <p style={{ color: "var(--c-danger-h)", fontSize: 13, textAlign: "center", margin: "0 0 10px" }}>{error}</p>
          )}
          {active ? (
            <button type="button" onClick={handleCancel} disabled={busy} style={ctaStyle("var(--c-bg-muted-2)", "var(--c-text-3b)", busy)}>
              구독 해지
            </button>
          ) : (
            <>
              {/* 로그인 전에는 결제를 시작하지 않는다(구독권은 계정에 붙는다) —
                  버튼 문구부터 로그인임을 알려 결제 후 에러가 나지 않게 한다. */}
              <button type="button" onClick={handleBuy} disabled={busy} className="press" style={ctaStyle("#3182F6", "#fff", busy)}>
                {busy
                  ? "처리 중…"
                  : !authenticated
                    ? "로그인하고 구독 시작하기"
                    : `${plans.find((p) => p.id === selected)?.name ?? "구독"} 시작하기`}
              </button>
              {inApp && (
                <button
                  type="button"
                  onClick={() => restore().catch(() => {})}
                  disabled={busy}
                  style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "var(--c-text-4b)", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
                >
                  구매 복원
                </button>
              )}
              {!inApp && (
                <p style={{ fontSize: 12, color: "var(--c-text-5)", textAlign: "center", margin: "9px 0 0", lineHeight: 1.5 }}>
                  구독 결제는 스타디 앱에서 진행할 수 있어요
                </p>
              )}
            </>
          )}
          <LegalFooter />
        </div>
      )}

      {/* 구독 해지 확인 모달 (WKWebView에서 window.confirm 미동작 → 인앱 모달) */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCancelConfirm(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: "24px 20px 16px", width: "100%", maxWidth: 320, boxSizing: "border-box" }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: "#191F28", textAlign: "center" }}>구독을 해지하시겠어요?</div>
            <p style={{ fontSize: 13.5, color: "#6B7280", textAlign: "center", margin: "8px 0 18px", lineHeight: 1.55 }}>
              남은 이용 기간까지는 그대로 이용할 수 있어요.
              <br />
              스토어 구독 관리 화면으로 이동합니다.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={() => setShowCancelConfirm(false)} style={{ border: "none", borderRadius: 12, background: "#F2F4F6", color: "#4E5968", padding: "12px 0", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false);
                  openStoreManage();
                }}
                style={{ border: "none", borderRadius: 12, background: "#3182F6", color: "#fff", padding: "12px 0", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}
              >
                해지하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 자동갱신 구독 필수 고지 + 이용약관(EULA)·개인정보처리방침 링크 (앱 심사 3.1.2c).
// 미구독·구독중 상태 모두 하단에 항상 보인다.
function LegalFooter() {
  // SSR에선 플랫폼을 알 수 없으므로(항상 null → Apple 문구) 클라이언트에서
  // 판별해 상태로 반영한다 — 렌더 중 직접 읽으면 hydration 불일치가 난다.
  const [isApple, setIsApple] = useState(true);
  useEffect(() => {
    setIsApple(detectPlatform() !== "google");
  }, []);
  const storeName = isApple ? "App Store" : "Google Play";
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, color: "#B0B8C1", lineHeight: 1.55, margin: 0, textAlign: "center" }}>
        구독은 기간 종료 24시간 전까지 해지하지 않으면 자동으로 갱신되며, 요금은 {storeName} 계정으로
        청구됩니다. 구독은 {storeName} 계정 설정에서 언제든지 관리·해지할 수 있어요.
      </p>
      <p style={{ fontSize: 11.5, textAlign: "center", margin: "7px 0 0" }}>
        <a
          href={isApple ? APPLE_STD_EULA_URL : "/mypage/terms/service"}
          target={isApple ? "_blank" : undefined}
          rel="noopener noreferrer"
          style={{ color: "#8B95A1", fontWeight: 600, textDecoration: "underline" }}
        >
          이용약관(EULA)
        </a>
        <span style={{ color: "#D1D6DB", margin: "0 8px" }}>|</span>
        <a href={PRIVACY_URL} style={{ color: "#8B95A1", fontWeight: 600, textDecoration: "underline" }}>
          개인정보처리방침
        </a>
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  subLabel,
  badge,
  highlight,
}: {
  plan: { id: PlanId; name: string; priceKrw: number; period: "month" | "year" };
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
        border: selected ? "2px solid var(--c-brand-b)" : "2px solid var(--c-bg-muted-20)",
        background: selected ? "var(--c-brand-soft-8)" : "var(--c-bg)",
        borderRadius: 16,
        padding: "16px 14px 14px",
        cursor: "pointer",
        transition: "border-color .12s, background .12s",
      }}
    >
      {badge && (
        <span style={{ position: "absolute", top: -9, left: 12, background: "var(--c-brand-b)", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999 }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--c-text-b)" }}>{plan.name}</div>
      {/* 앱 심사 3.1.2(c): 가장 크고 눈에 띄는 가격은 반드시 "실제 청구 금액"이어야 한다.
          월 환산가(9,900원/월 등)를 크게 쓰면 리젝 — 환산가는 subLabel/highlight 로만. */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: selected ? "var(--c-brand-deep-4)" : "var(--c-text-b)" }}>
          {won(plan.priceKrw)}
        </span>
        <span style={{ fontSize: 13, color: "var(--c-text-4b)", fontWeight: 700 }}>
          {plan.period === "month" ? "원/월" : "원/년"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--c-text-4b)", marginTop: 3 }}>{subLabel}</div>
      {highlight && (
        <div style={{ marginTop: 9, fontSize: 11.5, fontWeight: 800, color: "var(--c-brand-deep-4)", background: "var(--c-brand-soft-11)", borderRadius: 7, padding: "4px 7px", display: "inline-block" }}>
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
    <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--c-brand-soft-12)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/premium/medal-gold.svg" alt="" style={{ width: 38, height: 38 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--c-text-b)" }}>{planName} 이용 중</div>
      {entitlement.expiresAt && (
        <div style={{ fontSize: 13.5, color: "var(--c-text-3)", marginTop: 6 }}>
          {canceled ? "이용 종료일" : entitlement.autoRenew ? "다음 갱신일" : "이용 종료일"} {fmtDate(entitlement.expiresAt)}
        </div>
      )}
      <div style={{ marginTop: 18, background: "var(--c-bg-soft)", borderRadius: 14, padding: "14px 16px", textAlign: "left" }}>
        {BENEFITS.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/premium/check-blue.svg" alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: "var(--c-text-3b)", fontWeight: 600 }}>{b.label}</span>
          </div>
        ))}
      </div>
      {canceled && (
        <p style={{ fontSize: 12.5, color: "var(--c-text-4b)", marginTop: 12 }}>해지 예약됨 · 위 종료일까지 이용할 수 있어요</p>
      )}
    </div>
  );
}

function BenefitStyles() {
  return (
    <style>{`
      /* 혜택 행: 아래에서 위로 떠오름. fill-mode 는 forwards 만 — 'both' 로 두면 애니메이션이
         (감춤 탭 등에서) 못 돌 때 시작 상태(투명)에 갇힌다(공지 팝업에서 겪은 사고). 그래서
         등장 전 상태는 키프레임 0% 로만 표현하고 초기 opacity 는 건드리지 않는다. */
      .benefit-row {
        position: relative; display: flex; align-items: center; gap: 12px;
        padding: 6px 8px; margin: 0 -8px; border-radius: 16px;
        animation: benefitRise 1s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      @keyframes benefitRise {
        0%   { opacity: 0; transform: translateY(18px) scale(0.985); }
        60%  { opacity: 1; }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      /* 프리즘 테두리: 행 뒤에 회전하는 무지갯빛 conic 그라디언트 원판을 두고, 그 위를
         행 배경(흰색)으로 덮어 1.5px 링만 보이게 한다. 회전은 transform 이라 구형 웹뷰에서도
         돈다(@property 각도 애니메이션은 iOS 16 이전에서 멈춘다). 밝아졌다 사라진다. */
      .benefit-prism {
        position: absolute; inset: 0; border-radius: 16px; overflow: hidden;
        pointer-events: none; opacity: 0; z-index: 0;
        animation: benefitPrismFade 2.4s cubic-bezier(0.4, 0, 0.2, 1) var(--d, 0ms) forwards;
      }
      .benefit-prism::before {
        content: ""; position: absolute; left: 50%; top: 50%;
        width: 260%; padding-top: 260%; margin: -130% 0 0 -130%;
        /* 빛 띠를 넓게(약 240°) 펴서 테두리의 대부분을 두르며 감싸듯 돈다.
           앞머리는 밝고 꼬리는 길게 은은히 이어진다. */
        background: conic-gradient(from 0deg,
          transparent 0deg,
          rgba(125,196,255,0.10) 60deg,
          rgba(125,196,255,0.45) 130deg,
          rgba(196,181,253,0.85) 200deg,
          rgba(255,183,213,0.95) 245deg,
          rgba(255,224,150,1.0)  280deg,
          rgba(255,255,255,0.95) 300deg,
          transparent 318deg, transparent 360deg);
        filter: blur(0.6px);
        animation: benefitPrismSpin 2.4s cubic-bezier(0.4, 0, 0.2, 1) var(--d, 0ms) forwards;
      }
      .benefit-prism::after {
        content: ""; position: absolute; inset: 2px; border-radius: 14px; background: var(--c-bg);
      }
      .benefit-row > :not(.benefit-prism) { position: relative; z-index: 1; }
      @keyframes benefitPrismSpin { from { transform: rotate(-90deg); } to { transform: rotate(450deg); } }
      @keyframes benefitPrismFade {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        70%  { opacity: 0.9; }
        100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .benefit-row { animation: none; }
        .benefit-prism { display: none; }
      }
    `}</style>
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
