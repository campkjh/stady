"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";
import MyActivityCard from "@/components/MyActivityCard";
import { getTheme, setTheme, type ThemePreference } from "@/lib/theme";

interface Entitlement {
  active: boolean;
  planId: string | null;
  status: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  monthly: "월간 구독",
  suneung_annual: "수능 구독",
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

const MENU_GROUP_1 = [
  { label: "내가쓴글", href: "/mypage/my-posts", icon: "/icons/mp-education.svg" },
  { label: "결제로그", href: "/mypage/payments", icon: "/icons/mp-account.svg" },
  { label: "친구초대", href: "/referral-event", icon: "/icons/mp-friend.svg" },
];

const MENU_GROUP_2 = [
  { label: "공지사항", href: "/notice", icon: "/icons/mp-notice.svg" },
  { label: "자주묻는질문", href: "/faq", icon: "/icons/mp-faq.svg" },
  { label: "고객센터", href: "/customer-center", icon: "/icons/mp-support.svg" },
  { label: "모든약관", href: "/mypage/terms", icon: "/icons/mp-terms.svg" },
];

function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-b)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function MenuRow({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <Link href={href} className="press" style={rowStyle}>
      <span style={iconBox}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" style={{ height: 30, width: "auto", maxWidth: 34 }} />
      </span>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--c-text-b)" }}>{label}</span>
      <Chevron />
    </Link>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

// 화면 테마(라이트/다크/시스템) 3택 세그먼트 — 다른 메뉴 행과 같은 규격(높이 60·좌우 20)에 우측 컨트롤만 다르다.
function ThemeRow() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    setPref(getTheme());
  }, []);
  return (
    <div style={rowStyle}>
      <span style={iconBox}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/mp-theme.svg" alt="" style={{ height: 30, width: "auto", maxWidth: 34 }} />
      </span>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--c-text-b)" }}>화면 테마</span>
      <div role="radiogroup" aria-label="화면 테마" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 11, background: "var(--c-bg-muted-2)" }}>
        {THEME_OPTIONS.map((opt) => {
          const on = pref === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              className="press"
              onClick={() => {
                setTheme(opt.value);
                setPref(opt.value);
              }}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "6px 11px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                background: on ? "var(--c-bg)" : "transparent",
                color: on ? "var(--c-text-b)" : "var(--c-text-4b)",
                // 1px 링을 덧대 다크(그림자가 안 보임)에서도 활성 칩 윤곽이 살게.
                boxShadow: on ? "0 1px 4px rgba(15,23,42,0.10), 0 0 0 1px var(--c-border)" : "none",
                transition: "background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const [ent, setEnt] = useState<Entitlement | null>(null);

  const loadSub = useCallback(async () => {
    try {
      const res = await fetch("/api/iap/status", { credentials: "include" });
      const data = await res.json();
      setEnt(data.entitlement ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) loadSub();
  }, [isLoggedIn, loadSub]);

  if (isLoggedIn === null) return null;
  if (isLoggedIn === false) return <LoginRequired />;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  const active = !!ent?.active;
  const planName = ent?.planId ? PLAN_NAMES[ent.planId] ?? "프리미엄" : "프리미엄";

  return (
    <div style={{ background: "var(--c-bg)", minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Profile settings */}
      <Link href="/mypage/profile" className="press" style={{ ...rowStyle, marginTop: 8 }}>
        <span style={iconBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mypage-profile.png" alt="" style={{ height: 30, width: "auto", maxWidth: 34 }} />
        </span>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--c-text-b)" }}>프로필설정</span>
        <Chevron />
      </Link>

      <div style={dividerStyle} />

      {/* 내 경험치 + 뱃지 현황 */}
      <MyActivityCard />

      <div style={dividerStyle} />

      {/* Subscription package */}
      <div style={{ padding: "24px 20px 22px" }}>
        <h2 style={{ fontSize: 23, fontWeight: 800, margin: 0, lineHeight: 1.3, letterSpacing: "-0.4px" }}>
          <span style={{ color: "var(--c-brand-b)" }}>스타디</span> <span style={{ color: "var(--c-text-b)" }}>프리미엄</span>
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--c-text-4b)", margin: "10px 0 0", fontWeight: 500 }}>
          {active
            ? `${planName} 이용 중${
                ent?.expiresAt
                  ? ` · ${ent.autoRenew ? "다음 갱신일" : "이용 종료일"} ${fmtDate(ent.expiresAt)}`
                  : ""
              }`
            : "1등급을 위한 학습자료를 놓치지 마세요!"}
        </p>
        <Link
          href="/subscribe"
          className="press"
          style={{
            display: "inline-block",
            marginTop: 16,
            borderRadius: 8,
            background: "var(--c-tint-a5)",
            color: "var(--c-text-3b)",
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {active ? "구독 관리" : "구독하기"}
        </Link>
      </div>

      {/* Menu group 1 */}
      {MENU_GROUP_1.map((item) => (
        <MenuRow key={item.label} {...item} />
      ))}

      <div style={dividerStyle} />

      {/* Menu group 2 */}
      {MENU_GROUP_2.map((item) => (
        <MenuRow key={item.label} {...item} />
      ))}
      <ThemeRow />

      <div style={dividerStyle} />

      {/* Logout */}
      <button type="button" onClick={handleLogout} className="press" style={{ ...rowStyle, width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--c-text-4b)" }}>로그아웃</span>
        <Chevron />
      </button>

      {/* Footer */}
      <div style={{ padding: "24px 20px 32px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/stady-logo.svg" alt="Stady" style={{ width: 64, height: "auto", filter: "grayscale(100%)", opacity: 0.25, marginBottom: 12 }} />
        <div style={{ fontSize: 11, lineHeight: 1.8, color: "var(--c-text-5b)" }}>
          <p>스타디 | 우 06314  경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
          <p>T 01047269276 | E tlsdml0507@naver.com</p>
          <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
          <p>Copyright© stady. All right reserved.</p>
        </div>
        <p style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: "var(--c-text-4f)" }}>
          버전 {process.env.APP_VERSION} · {(process.env.BUILD_DATE || "").replace(/-/g, ".")} 업데이트
        </p>
      </div>
    </div>
  );
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  height: 60,
  padding: "0 20px",
  textDecoration: "none",
} as const;

const iconBox = {
  width: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

const dividerStyle = {
  height: 10,
  background: "var(--c-bg-soft)",
} as const;
