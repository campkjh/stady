"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";
import MyActivityCard from "@/components/MyActivityCard";

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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#191F28" }}>{label}</span>
      <Chevron />
    </Link>
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
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Profile settings */}
      <Link href="/mypage/profile" className="press" style={{ ...rowStyle, marginTop: 8 }}>
        <span style={iconBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mypage-profile.png" alt="" style={{ height: 30, width: "auto", maxWidth: 34 }} />
        </span>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#191F28" }}>프로필설정</span>
        <Chevron />
      </Link>

      <div style={dividerStyle} />

      {/* 내 경험치 + 뱃지 현황 */}
      <MyActivityCard />

      <div style={dividerStyle} />

      {/* Subscription package */}
      <div style={{ padding: "24px 20px 22px" }}>
        <h2 style={{ fontSize: 23, fontWeight: 800, margin: 0, lineHeight: 1.3, letterSpacing: "-0.4px" }}>
          <span style={{ color: "#3182F6" }}>스타디</span> <span style={{ color: "#191F28" }}>프리미엄</span>
        </h2>
        <p style={{ fontSize: 14.5, color: "#8B95A1", margin: "10px 0 0", fontWeight: 500 }}>
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
            background: "rgba(7,25,76,0.05)",
            color: "#4E5968",
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

      <div style={dividerStyle} />

      {/* Logout */}
      <button type="button" onClick={handleLogout} className="press" style={{ ...rowStyle, width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#8B95A1" }}>로그아웃</span>
        <Chevron />
      </button>

      {/* Footer */}
      <div style={{ padding: "24px 20px 32px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/stady-logo.svg" alt="Stady" style={{ width: 64, height: "auto", filter: "grayscale(100%)", opacity: 0.25, marginBottom: 12 }} />
        <div style={{ fontSize: 11, lineHeight: 1.8, color: "#C0C0C0" }}>
          <p>스타디 | 우 06314  경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
          <p>T 01047269276 | E tlsdml0507@naver.com</p>
          <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
          <p>Copyright© stady. All right reserved.</p>
        </div>
        <p style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: "#B8BCC4" }}>
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
  background: "#F9FAFB",
} as const;
