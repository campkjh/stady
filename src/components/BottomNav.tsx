"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 프리티풀(토스) 하단바: 아이콘·글자 색은 하나(#4E5968, 다크는 밝은 회색)이고,
// 선택된 탭은 색이 아니라 "채움 아이콘 + 굵은 글자(600)"로 드러낸다.
// 아이콘 5개는 한 세트(24 격자 · 선 1.8 · 둥근 끝/꺾임, Lucide 형태)로 맞췄고, 선택 상태는 **같은 모양을 채운 것**이라
// 눌렀을 때 모양이 바뀌지 않고 속만 차오른다. (예전엔 출처가 다른 경로를 섞어 선 굵기·모양이 들쑥날쑥했다.)
const COMMUNITY_VISITED_KEY = "stady_community_visited";
const COMMUNITY_SEEN_KEY = "stady_community_seen_at";

const ICON = 26;
const SW = 1.8;

/** 채움 상태에서 안쪽 선(문·모자 겹침 등)을 바 바탕색으로 파서 구분한다 */
const CUT = "var(--c-bg)";

function Glyph({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <svg
      width={ICON}
      height={ICON}
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <Glyph active={active}>
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" stroke={active ? CUT : "currentColor"} />
    </Glyph>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <Glyph active={active}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </Glyph>
  );
}

function MyIcon({ active }: { active: boolean }) {
  return (
    <Glyph active={active}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Glyph>
  );
}

// 커뮤니티 = 학사모(스타디 아이콘 그대로의 의미). 모자 아래 받침을 먼저 그리고 모자를 위에 얹어 겹침을 깔끔하게.
function CommunityIcon({ active }: { active: boolean }) {
  return (
    <Glyph active={active}>
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
      <path d="M22 10v6" />
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" stroke={active ? CUT : "currentColor"} />
    </Glyph>
  );
}

function FlameIcon({ active }: { active: boolean }) {
  return (
    <Glyph active={active}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Glyph>
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
