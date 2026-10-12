"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 프리티풀(토스) 하단바: 아이콘·글자 색은 하나(#4E5968, 다크는 밝은 회색)이고,
// 선택된 탭은 색이 아니라 "채움 아이콘 + 굵은 글자(600)"로 드러낸다. 안 선택은 선 아이콘.
// 아이콘은 모두 토스 mono 세트(~/Downloads/아이콘): 홈·책갈피는 -line 짝이 있고, 나머지는 채움 경로를 1.7px 선으로 두른 것.
const COMMUNITY_VISITED_KEY = "stady_community_visited";
const COMMUNITY_SEEN_KEY = "stady_community_seen_at";

const ICON = 26;

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M21.0688 8.20407L12.6218 1.48707C12.4451 1.34623 12.2258 1.26953 11.9998 1.26953C11.7738 1.26953 11.5545 1.34623 11.3778 1.48707L2.9298 8.20407C2.69436 8.39135 2.50419 8.62933 2.37347 8.90029C2.24275 9.17126 2.17484 9.46822 2.1748 9.76907V19.1871C2.1748 19.8236 2.42766 20.434 2.87775 20.8841C3.32784 21.3342 3.93828 21.5871 4.5748 21.5871H9.9998V16.8351C9.9998 16.5699 10.1052 16.3155 10.2927 16.128C10.4802 15.9404 10.7346 15.8351 10.9998 15.8351H12.9998C13.265 15.8351 13.5194 15.9404 13.7069 16.128C13.8944 16.3155 13.9998 16.5699 13.9998 16.8351V21.5871H19.4238C20.0603 21.5871 20.6708 21.3342 21.1209 20.8841C21.5709 20.434 21.8238 19.8236 21.8238 19.1871V9.77007C21.8238 9.46922 21.7559 9.17226 21.6251 8.90129C21.4944 8.63033 21.3043 8.39135 21.0688 8.20407Z" /></svg>
  ) : (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M19.1002 22.7H13.5002V16.7H10.6002V22.7H5.0002C3.2002 22.7 1.7002 21.2 1.7002 19.4V10.4C1.7002 9.5 2.1002 8.7 2.8002 8.1L10.8002 1.7C11.5002 1.1 12.5002 1.1 13.2002 1.7L21.3002 8.1C22.0002 8.7 22.4002 9.5 22.4002 10.4V19.4C22.4002 21.2 20.9002 22.7 19.1002 22.7ZM15.5002 20.7H19.1002C19.8002 20.7 20.4002 20.1 20.4002 19.4V10.4C20.4002 10.1 20.3002 9.9 20.1002 9.7L12.0002 3.3L3.9002 9.7C3.7002 9.9 3.6002 10.1 3.6002 10.4V19.4C3.6002 20.1 4.2002 20.7 4.9002 20.7H8.5002V16.7C8.5002 15.6 9.4002 14.7 10.5002 14.7H13.4002C14.5002 14.7 15.4002 15.6 15.4002 16.7V20.7H15.5002Z" /></svg>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M3.5 3.9998C3.5 3.2998 4 2.7998 4.7 2.7998H19.3C20 2.7998 20.5 3.2998 20.5 3.9998V21.1998C20.5 21.6998 20 21.9998 19.6 21.6998L12.6 17.6998C12.2 17.4998 11.8 17.4998 11.4 17.6998L4.4 21.6998C4 21.8998 3.5 21.5998 3.5 21.1998V3.9998Z" /></svg>
  ) : (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M20.178 3.1538C19.96 2.9248 19.648 2.7998 19.3 2.7998H4.7C4.362 2.7998 4.055 2.9198 3.837 3.1378C3.62 3.3548 3.5 3.6618 3.5 3.9998V20.4918C3.5 21.2598 4.33 21.7408 4.996 21.3598L11.4 17.6998C11.799 17.5008 12.203 17.5008 12.6 17.6998L19.004 21.3588C19.671 21.7398 20.5 21.2588 20.5 20.4908V3.9998C20.5 3.6618 20.38 3.3548 20.178 3.1538ZM18.499 18.7688L13.599 15.9678L13.494 15.9108C13.013 15.6698 12.506 15.5498 12 15.5498C11.494 15.5498 10.987 15.6698 10.504 15.9118L5.499 18.7678V4.7998H18.499V18.7688Z" /></svg>
  );
}

function MyIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M16.8872 6.64352C16.8872 7.28634 16.7607 7.92288 16.5148 8.5168C16.2688 9.11071 15.9083 9.65037 15.4538 10.105C14.9993 10.5595 14.4597 10.9202 13.8659 11.1662C13.272 11.4123 12.6355 11.539 11.9927 11.539C10.6944 11.5392 9.44932 11.0236 8.53124 10.1057C7.61315 9.18777 7.0973 7.94276 7.09717 6.64452C7.09711 6.0017 7.22365 5.36516 7.46959 4.77125C7.71553 4.17734 8.07603 3.63768 8.53053 3.18309C9.44843 2.265 10.6934 1.74916 11.9917 1.74902C13.2899 1.74889 14.535 2.26449 15.4531 3.18238C16.3712 4.10028 16.887 5.34529 16.8872 6.64352ZM11.9922 13.0365C4.94317 13.0365 2.20117 17.5225 2.20117 19.6095C2.20117 21.6955 8.03817 22.2515 11.9922 22.2515C15.9462 22.2515 21.7832 21.6955 21.7832 19.6095C21.7832 17.5225 19.0412 13.0365 11.9922 13.0365Z" /></svg>
  ) : (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(12 12) scale(0.94) translate(-12 -12)" fill="none" stroke="currentColor" strokeWidth={1.7 / 0.94} strokeLinejoin="round" strokeLinecap="round"><path fillRule="evenodd" d="M16.8872 6.64352C16.8872 7.28634 16.7607 7.92288 16.5148 8.5168C16.2688 9.11071 15.9083 9.65037 15.4538 10.105C14.9993 10.5595 14.4597 10.9202 13.8659 11.1662C13.272 11.4123 12.6355 11.539 11.9927 11.539C10.6944 11.5392 9.44932 11.0236 8.53124 10.1057C7.61315 9.18777 7.0973 7.94276 7.09717 6.64452C7.09711 6.0017 7.22365 5.36516 7.46959 4.77125C7.71553 4.17734 8.07603 3.63768 8.53053 3.18309C9.44843 2.265 10.6934 1.74916 11.9917 1.74902C13.2899 1.74889 14.535 2.26449 15.4531 3.18238C16.3712 4.10028 16.887 5.34529 16.8872 6.64352ZM11.9922 13.0365C4.94317 13.0365 2.20117 17.5225 2.20117 19.6095C2.20117 21.6955 8.03817 22.2515 11.9922 22.2515C15.9462 22.2515 21.7832 21.6955 21.7832 19.6095C21.7832 17.5225 19.0412 13.0365 11.9922 13.0365Z" /></g></svg>
  );
}

function CommunityIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M13.2578 16.9901C12.8778 17.2098 12.4467 17.3253 12.0078 17.3251C11.569 17.3259 11.1377 17.2106 10.7578 16.9911L4.34277 13.2871V17.1891C4.34277 17.5461 4.53277 17.8761 4.84277 18.0541L11.5078 21.9031C11.8178 22.0811 12.1978 22.0811 12.5078 21.9031L19.1728 18.0531C19.4828 17.8761 19.6728 17.5461 19.6728 17.1891V13.2871L13.2578 16.9901Z" /><path fillRule="evenodd" clipRule="evenodd" d="M23.0529 7.87195L12.5069 1.78195C12.3548 1.69447 12.1823 1.64844 12.0069 1.64844C11.8314 1.64844 11.659 1.69447 11.5069 1.78195L0.96187 7.87195C0.809863 7.95972 0.683636 8.08596 0.595876 8.23797C0.508116 8.38999 0.461914 8.56242 0.461914 8.73795C0.461914 8.91348 0.508116 9.08591 0.595876 9.23793C0.683636 9.38994 0.809863 9.51618 0.96187 9.60395L11.5089 15.6919C11.6608 15.7799 11.8333 15.8262 12.0089 15.8262C12.1844 15.8262 12.3569 15.7799 12.5089 15.6919L20.9069 10.8439V15.1329H22.4069V9.97695L23.0549 9.60295C23.2069 9.51518 23.3331 9.38894 23.4209 9.23693C23.5086 9.08491 23.5548 8.91248 23.5548 8.73695C23.5548 8.56142 23.5086 8.38899 23.4209 8.23697C23.3331 8.08496 23.2069 7.95872 23.0549 7.87095" /></svg>
  ) : (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(12 12) scale(0.94) translate(-12 -12)" fill="none" stroke="currentColor" strokeWidth={1.7 / 0.94} strokeLinejoin="round" strokeLinecap="round"><path fillRule="evenodd" d="M13.2578 16.9901C12.8778 17.2098 12.4467 17.3253 12.0078 17.3251C11.569 17.3259 11.1377 17.2106 10.7578 16.9911L4.34277 13.2871V17.1891C4.34277 17.5461 4.53277 17.8761 4.84277 18.0541L11.5078 21.9031C11.8178 22.0811 12.1978 22.0811 12.5078 21.9031L19.1728 18.0531C19.4828 17.8761 19.6728 17.5461 19.6728 17.1891V13.2871L13.2578 16.9901Z" /><path fillRule="evenodd" d="M23.0529 7.87195L12.5069 1.78195C12.3548 1.69447 12.1823 1.64844 12.0069 1.64844C11.8314 1.64844 11.659 1.69447 11.5069 1.78195L0.96187 7.87195C0.809863 7.95972 0.683636 8.08596 0.595876 8.23797C0.508116 8.38999 0.461914 8.56242 0.461914 8.73795C0.461914 8.91348 0.508116 9.08591 0.595876 9.23793C0.683636 9.38994 0.809863 9.51618 0.96187 9.60395L11.5089 15.6919C11.6608 15.7799 11.8333 15.8262 12.0089 15.8262C12.1844 15.8262 12.3569 15.7799 12.5089 15.6919L20.9069 10.8439V15.1329H22.4069V9.97695L23.0549 9.60295C23.2069 9.51518 23.3331 9.38894 23.4209 9.23693C23.5086 9.08491 23.5548 8.91248 23.5548 8.73695C23.5548 8.56142 23.5086 8.38899 23.4209 8.23697C23.3331 8.08496 23.2069 7.95872 23.0549 7.87095" /></g></svg>
  );
}

function FlameIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M19.999 5.99885C20.223 7.61185 20.05 8.72985 18.82 8.72985C17.031 8.72985 17.031 4.85285 14.01 2.73385C10.99 0.514851 8.86502 1.01885 8.75202 1.12085C11.213 3.03785 9.87102 6.10785 8.19302 6.91485C6.62702 7.72185 4.81802 6.63685 5.71302 4.21685C3.35202 6.26285 1.99902 8.72685 1.99902 12.0009C1.99902 17.5069 6.51502 22.0009 11.996 22.0009C17.999 22.0009 21.999 17.0009 21.999 12.0009C21.999 10.0009 21.471 8.00085 20 5.99985L19.999 5.99885ZM11.996 20.9329C9.77702 20.9329 8.06202 19.2179 8.06202 16.9989C8.06202 13.7719 11.996 11.5529 11.996 11.5529C11.996 11.5529 15.93 13.7719 15.93 16.9989C15.93 19.1159 14.215 20.9329 11.996 20.9329Z" /><path fillRule="evenodd" clipRule="evenodd" opacity="0.5" d="M11.9999 11.5537C11.9999 11.5537 8.06592 13.7727 8.06592 16.9997C8.06592 19.2187 9.78092 20.9337 11.9999 20.9337C14.2189 20.9337 15.9339 19.1187 15.9339 16.9997C15.9339 13.7727 11.9999 11.5537 11.9999 11.5537Z" /></svg>
  ) : (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(12 12) scale(0.94) translate(-12 -12)" fill="none" stroke="currentColor" strokeWidth={1.7 / 0.94} strokeLinejoin="round" strokeLinecap="round"><path fillRule="evenodd" d="M19.999 5.99885C20.223 7.61185 20.05 8.72985 18.82 8.72985C17.031 8.72985 17.031 4.85285 14.01 2.73385C10.99 0.514851 8.86502 1.01885 8.75202 1.12085C11.213 3.03785 9.87102 6.10785 8.19302 6.91485C6.62702 7.72185 4.81802 6.63685 5.71302 4.21685C3.35202 6.26285 1.99902 8.72685 1.99902 12.0009C1.99902 17.5069 6.51502 22.0009 11.996 22.0009C17.999 22.0009 21.999 17.0009 21.999 12.0009C21.999 10.0009 21.471 8.00085 20 5.99985L19.999 5.99885ZM11.996 20.9329C9.77702 20.9329 8.06202 19.2179 8.06202 16.9989C8.06202 13.7719 11.996 11.5529 11.996 11.5529C11.996 11.5529 15.93 13.7719 15.93 16.9989C15.93 19.1159 14.215 20.9329 11.996 20.9329Z" /></g></svg>
  );
}

// 아이콘 래퍼: 누른 탭만 key가 바뀌며 다시 마운트돼 바운스가 매번 처음부터 재생된다.
function NavIcon({ on, n, children }: { on: boolean; n: number; children: React.ReactNode }) {
  return (
    <span key={on ? `b${n}` : "i"} className={`main-nav-ico${on ? " is-bounce" : ""}`}>
      {children}
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [hasNewCommunity, setHasNewCommunity] = useState(false);
  // 아래로 스크롤하면 라벨을 접어 네비를 낮추고, 위로 올리면 다시 펼친다.
  const [compact, setCompact] = useState(false);
  // 태블릿 알약 네비: 활성 탭 자리로 미끄러지는 흰 카드의 위치/크기.
  const listRef = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // 탭을 누르면 그 아이콘만 쫀득하게 튀도록(누를 때마다 다시 재생되게 카운터를 올린다).
  const [bounce, setBounce] = useState<{ href: string; n: number }>({ href: "", n: 0 });

  // 안 본 새 글 인디케이터: 최신 글 시각이 마지막으로 본 시각보다 뒤면 빨간 점.
  // 커뮤니티 화면을 보고 있으면 본 것으로 표시하고 점을 끈다.
  useEffect(() => {
    let cancelled = false;
    const onCommunity = pathname.startsWith("/community");
    fetch("/api/community/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const latest = data?.latest ? new Date(data.latest).getTime() : 0;
        if (!latest) { setHasNewCommunity(false); return; }
        if (onCommunity) {
          try { localStorage.setItem(COMMUNITY_SEEN_KEY, String(latest)); } catch {}
          setHasNewCommunity(false);
          return;
        }
        let seen = 0;
        try { seen = Number(localStorage.getItem(COMMUNITY_SEEN_KEY) || 0); } catch {}
        setHasNewCommunity(latest > seen);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  function markCommunityVisited() {
    localStorage.setItem(COMMUNITY_VISITED_KEY, "true");
    try { localStorage.setItem(COMMUNITY_SEEN_KEY, String(Date.now())); } catch {}
    setHasNewCommunity(false);
  }

  useEffect(() => {
    // 화면을 옮기면 항상 펼친 상태로 시작.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompact(false);
    let lastY = window.scrollY;
    // scrollY만 읽고 방향이 바뀔 때만 상태를 바꾸므로 리스너에서 바로 처리한다
    // (rAF로 미루면 백그라운드 탭에서 콜백이 아예 안 돌아 동작이 죽는다).
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      // 손떨림 정도의 이동은 무시(6px 넘게 움직였을 때만 방향으로 인정).
      if (Math.abs(dy) < 6) return;
      lastY = y;
      // 최상단 근처에서는 항상 펼쳐둔다.
      setCompact(y > 60 && dy > 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // 활성 탭의 실제 위치를 재서 흰 카드를 그 자리로 옮긴다. 라벨이 접혀 높이가
  // 변하는 동안에도 따라오도록 ResizeObserver로 계속 다시 잰다.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>('a[data-active="true"]');
      if (!el) {
        setPill(null);
        return;
      }
      const lr = list.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const next = {
        x: Math.round(er.left - lr.left),
        y: Math.round(er.top - lr.top),
        w: Math.round(er.width),
        h: Math.round(er.height),
      };
      // 값이 그대로면 리렌더하지 않는다(리사이즈 옵저버가 매 프레임 부르므로).
      setPill((cur) => (cur && cur.x === next.x && cur.y === next.y && cur.w === next.w && cur.h === next.h ? cur : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(list);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [pathname]);

  function pop(href: string) {
    setBounce((b) => ({ href, n: b.n + 1 }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  // 탭 5개 — 안 읽은 새 글은 숫자 대신 빨간 점(프리티풀 하단바와 같다)
  const items: { href: string; label: string; icon: (active: boolean) => React.ReactNode; dot?: boolean; onTap?: () => void }[] = [
    { href: "/", label: "홈", icon: (a) => <HomeIcon active={a} /> },
    { href: "/community", label: "커뮤니티", icon: (a) => <CommunityIcon active={a} />, dot: hasNewCommunity, onTap: markCommunityVisited },
    { href: "/timer", label: "옵시디언", icon: (a) => <FlameIcon active={a} /> },
    { href: "/bookmarks", label: "책갈피", icon: (a) => <BookmarkIcon active={a} /> },
    { href: "/mypage", label: "마이홈", icon: (a) => <MyIcon active={a} /> },
  ];

  if (pathname.startsWith("/community/write")) {
    return null;
  }

  return (
    <>
    <nav className="main-nav" data-compact={compact ? "true" : "false"} style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      backgroundColor: "var(--c-bg)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <ul ref={listRef} className="main-nav-list" style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        alignItems: "center",
        height: 58,
        maxWidth: 720,
        margin: "0 auto",
        listStyle: "none",
        padding: "0 12px",
      }}>
        {/* 활성 탭 뒤에 깔리는 흰 카드(태블릿에서만 보임). 첫 측정 뒤에만 그리므로
            처음부터 제자리에 나타나고, 이후 탭 이동 때만 미끄러진다. */}
        {pill && (
          <span
            className="main-nav-pill"
            aria-hidden="true"
            style={{ transform: `translate3d(${pill.x}px, ${pill.y}px, 0)`, width: pill.w, height: pill.h }}
          />
        )}
        {items.map((tab) => {
          const on = isActive(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => { tab.onTap?.(); pop(tab.href); }}
                data-active={on ? "true" : "false"}
                aria-current={on ? "page" : undefined}
                className={`main-nav-item${on ? " is-on" : ""}`}
              >
                {tab.dot && <span className="main-nav-dot" aria-hidden="true" />}
                <NavIcon on={bounce.href === tab.href} n={bounce.n}>{tab.icon(on)}</NavIcon>
                <span className="main-nav-label">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
