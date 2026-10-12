"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";
import MyActivityCard from "@/components/MyActivityCard";
import StadyPrimeBanner from "@/components/StadyPrimeBanner";
import { getTheme, setTheme, type ThemePreference } from "@/lib/theme";
import { primeRemainingShort } from "@/lib/primeRemaining";
import { useEntrance } from "@/lib/entrance";
import { uiConfirm } from "@/lib/dialog";

/*
 * 마이페이지 — 프리티풀 마이 구성(토스 '전체' 탭 어법)으로.
 *  · 상단 헤더 없음. 이름 22px + 회색 한 줄(이메일) + 오른쪽 글자 링크 '프로필 설정 | 로그아웃'
 *  · '자주 쓰는 것' 4칸 타일(흰 58px 둥근 사각 + 컬러 아이콘 30px)
 *  · 흰 카드 목록(회색 아이콘 칩 40 · 굵은 제목 16 · 오른쪽 회색 설명 13) — 서비스 / 설정
 *  · '계정' 빨간 로그아웃
 *  · 바탕 #F4F6FA(다크는 어둡게). 인터랙션 = 퀵매칭 곡선(이름 아래→위, 나머지 칸 오른쪽→왼쪽 순차)
 * 기능(구독 상태 배너·활동 카드·테마·로그아웃)은 그대로다.
 */

interface Entitlement {
  active: boolean;
  planId: string | null;
  status: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  source?: string | null;
}

interface Me {
  nickname?: string;
  email?: string;
  avatar?: string | null;
}

const QUICK = [
  { label: "내 글·댓글", href: "/mypage/my-posts", icon: "/icons/mp-education.svg" },
  { label: "결제로그", href: "/mypage/payments", icon: "/icons/mp-account.svg" },
  { label: "친구초대", href: "/referral-event", icon: "/icons/mp-friend.svg" },
  { label: "구독 관리", href: "/subscribe", icon: "/icons/medal.svg" },
];

const SERVICE_ROWS = [
  { label: "공지사항", href: "/notice", icon: "/icons/mp-notice.svg" },
  { label: "자주묻는질문", href: "/faq", icon: "/icons/mp-faq.svg" },
  { label: "고객센터", href: "/customer-center", icon: "/icons/mp-support.svg" },
];

const SETTING_ROWS = [
  { label: "차단한사용자", href: "/mypage/blocked", icon: "/icons/toss/siren.svg" },
  { label: "모든약관", href: "/mypage/terms", icon: "/icons/mp-terms.svg" },
];

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mpx-sub)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Row({ label, href, icon, desc }: { label: string; href: string; icon: string; desc?: string }) {
  return (
    <Link href={href} className="press mpx-row">
      <span className="mpx-chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" />
      </span>
      <span className="mpx-row-t">{label}</span>
      {desc && <span className="mpx-row-d">{desc}</span>}
      <Chevron />
    </Link>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

// 화면 테마(라이트/다크/시스템) 3택 세그먼트 — 다른 행과 같은 규격에 우측 컨트롤만 다르다.
function ThemeRow() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    setPref(getTheme());
  }, []);
  return (
    <div className="mpx-row">
      <span className="mpx-chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/mp-theme.svg" alt="" />
      </span>
      <span className="mpx-row-t" style={{ whiteSpace: "nowrap" }}>화면 테마</span>
      <div role="radiogroup" aria-label="화면 테마" className="mpx-seg">
        {THEME_OPTIONS.map((opt) => {
          const on = pref === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`press mpx-seg-b${on ? " is-on" : ""}`}
              onClick={() => {
                setTheme(opt.value);
                setPref(opt.value);
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
  const enter = useEntrance("mypage");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setIsLoggedIn(!!data.user);
        if (data.user) setMe({ nickname: data.user.nickname, email: data.user.email, avatar: data.user.avatar });
      })
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
    if (!(await uiConfirm("로그아웃할까요?", { confirmLabel: "로그아웃" }))) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  const active = !!ent?.active;
  const name = me?.nickname || "스타디";
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="mpx">
      <div className={`mpx-wrap${enter ? " qd-body" : ""}`}>
        {/* 이름 줄 — 헤더 없이 맨 위 */}
        <div className="mpx-head">
          <span className="mpx-ava">
            {me?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt="" />
            ) : (
              initial
            )}
          </span>
          <div className="mpx-who">
            <p className={`mpx-name${enter ? " qd-a-title" : ""}`}>{name}</p>
            {me?.email && <p className="mpx-mail">{me.email}</p>}
          </div>
          <div className="mpx-links">
            <Link href="/mypage/profile" className="mpx-link">프로필 설정</Link>
            <span aria-hidden="true" className="mpx-bar" />
            <button type="button" className="mpx-link" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>

        {/* 자주 쓰는 것 */}
        <section>
          <p className="mpx-sec">자주 쓰는 것</p>
          <div className="mpx-tiles">
            {QUICK.map((q) => (
              <Link key={q.label} href={q.href} className="press mpx-tile">
                <span className="mpx-tile-ic">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.icon} alt="" />
                </span>
                <span className="mpx-tile-l">{q.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 스타디 프라임 배너 — 구독 중이면 남은 기간, 아니면 구독하기 */}
        <section>
          <Link href="/subscribe" className="press" style={{ display: "block", textDecoration: "none" }} aria-label={active ? "구독 관리" : "구독하기"}>
            <StadyPrimeBanner cta={active ? primeRemainingShort(ent?.expiresAt, ent?.source) : "구독하기"} />
          </Link>
        </section>

        {/* 내 경험치 + 뱃지 현황 */}
        <section>
          <div className="mpx-act">
            <MyActivityCard />
          </div>
        </section>

        <section>
          <p className="mpx-sec">서비스</p>
          <div className="mpx-card">
            {SERVICE_ROWS.map((r) => (
              <Row key={r.label} {...r} />
            ))}
          </div>
        </section>

        <section>
          <p className="mpx-sec">설정</p>
          <div className="mpx-card">
            <ThemeRow />
            {SETTING_ROWS.map((r) => (
              <Row key={r.label} {...r} />
            ))}
            <div className="mpx-row" style={{ cursor: "default" }}>
              <span className="mpx-chip mpx-chip-text">v</span>
              <span className="mpx-row-t">앱 버전</span>
              <span className="mpx-row-d" style={{ marginLeft: "auto" }}>
                {process.env.APP_VERSION} · {(process.env.BUILD_DATE || "").replace(/-/g, ".")}
              </span>
            </div>
          </div>
        </section>

        {/* 계정 */}
        <section>
          <p className="mpx-sec">계정</p>
          <div className="mpx-card">
            <button type="button" onClick={handleLogout} className="press mpx-row mpx-row-btn">
              <span className="mpx-chip mpx-chip-red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="mpx-row-t" style={{ color: "var(--mpx-danger)" }}>로그아웃</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <section className="mpx-foot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/stady-logo.svg" alt="Stady" style={{ width: 64, height: "auto", filter: "grayscale(100%)", opacity: 0.25, marginBottom: 12 }} />
          <div style={{ fontSize: 11, lineHeight: 1.8, color: "var(--mpx-sub)" }}>
            <p>스타디 | 우 06314  경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
            <p>T 01047269276 | E tlsdml0507@naver.com</p>
            <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
            <p>Copyright© stady. All right reserved.</p>
          </div>
        </section>
      </div>

      <style>{`
        .mpx {
          --mpx-bg: #F4F6FA; --mpx-card: #FFFFFF; --mpx-ink: #191F28; --mpx-sub: #8B95A1; --mpx-line: rgba(25, 31, 40, 0.06);
          --mpx-chip: #F2F4F6; --mpx-danger: #F04452; --mpx-accent: #3182F6;
          background: var(--mpx-bg); min-height: 100vh;
          padding-top: env(safe-area-inset-top, 0px);
          /* 하단 네비 여백(main 레이아웃 pb)까지 같은 바탕이 이어지게 — 다른 색 띠가 비치지 않도록 */
          margin-bottom: calc(-82px - env(safe-area-inset-bottom, 0px));
          padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px));
        }
        [data-theme="dark"] .mpx {
          --mpx-bg: #101116; --mpx-card: #1B1C23; --mpx-ink: #F2F4F8; --mpx-sub: #8E96A3; --mpx-line: rgba(255, 255, 255, 0.07);
          --mpx-chip: #262832; --mpx-danger: #F25A66; --mpx-accent: #6FA8FF;
        }
        .mpx-wrap { max-width: 560px; margin: 0 auto; padding: 8px 16px 40px; }
        .mpx-wrap > section { margin-top: 22px; }
        .mpx-head { display: flex; align-items: center; gap: 12px; padding: 20px 4px 0; }
        .mpx-ava {
          width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #7DB8FF, #3182F6); color: #fff; font-size: 22px; font-weight: 700;
        }
        .mpx-ava img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mpx-who { min-width: 0; flex: 1; }
        .mpx-name { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: var(--mpx-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mpx-mail { margin: 2px 0 0; font-size: 13px; color: var(--mpx-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mpx-links { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .mpx-link { border: 0; background: none; padding: 6px 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--mpx-sub); cursor: pointer; text-decoration: none; }
        .mpx-bar { width: 1px; height: 11px; background: var(--mpx-line); }
        .mpx-sec { margin: 0 0 10px 4px; font-size: 14px; font-weight: 700; color: var(--mpx-sub); }
        .mpx-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .mpx-tile { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; }
        .mpx-tile-ic {
          width: 58px; height: 58px; border-radius: 19px; background: var(--mpx-card);
          display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(25, 31, 40, 0.05);
        }
        .mpx-tile-ic img { height: 30px; width: auto; max-width: 34px; display: block; }
        .mpx-tile-l { font-size: 13px; font-weight: 600; color: var(--mpx-ink); text-align: center; letter-spacing: -0.2px; }
        .mpx-card { background: var(--mpx-card); border-radius: 22px; overflow: hidden; box-shadow: 0 2px 12px rgba(25, 31, 40, 0.04); }
        /* 활동 카드는 자체 카드(테두리·그림자)를 가졌다 — 이 화면의 흰 카드 규격(r22·테두리 없음)에 맞춘다 */
        .mpx-act > section { padding: 0 !important; }
        .mpx-act > section > div {
          border-radius: 22px !important; border: 0 !important; background: var(--mpx-card) !important;
          box-shadow: 0 2px 12px rgba(25, 31, 40, 0.04) !important; padding: 20px !important;
        }
        .mpx-row {
          display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; min-height: 64px; padding: 0 18px;
          text-decoration: none; background: none; border: 0; text-align: left; font-family: inherit; cursor: pointer;
        }
        .mpx-row + .mpx-row { border-top: 1px solid var(--mpx-line); }
        .mpx-row-btn { cursor: pointer; }
        .mpx-chip {
          width: 40px; height: 40px; border-radius: 13px; background: var(--mpx-chip); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .mpx-chip img { height: 24px; width: auto; max-width: 26px; display: block; }
        .mpx-chip-text { font-size: 15px; font-weight: 700; color: var(--mpx-sub); }
        .mpx-chip-red { color: var(--mpx-danger); background: rgba(240, 68, 82, 0.1); }
        .mpx-row-t { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.3px; color: var(--mpx-ink); }
        .mpx-row-d { font-size: 13px; color: var(--mpx-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .mpx-seg { display: flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--mpx-chip); flex-shrink: 0; margin-left: auto; }
        .mpx-seg-b { border: 0; cursor: pointer; padding: 6px 11px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 700; background: transparent; color: var(--mpx-sub); transition: background 0.16s ease, color 0.16s ease; }
        .mpx-seg-b.is-on { background: var(--mpx-card); color: var(--mpx-ink); box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1); }
        .mpx-foot { padding: 8px 4px 0; }
      `}</style>
    </div>
  );
}
