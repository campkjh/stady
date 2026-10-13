"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";
import { useEntrance } from "@/lib/entrance";
import { uiConfirm } from "@/lib/dialog";

/*
 * 알림 — 프리티풀 알림(토스 알림 어법)으로.
 *  · ‹ 뒤로 / 큰 '알림 ⌄'(거르기·모두 읽음·전체 삭제) / 새 알림 연파랑(#F2F6FC) 위 · '지난 알림'
 *  · 줄 = 컬러 아이콘 칸 · 제목 17 · 회색 본문 3줄 · 시간(방금 전/N분 전/N시간 전/M월 D일) + 'N건'(같은 글·같은 댓글에 쌓인 묶음)
 *  · 밀어서 삭제(묶음 단위) · 눌러서 읽음+이동
 *  · 인터랙션 = 퀵매칭 곡선: 제목 아래→위, 줄은 오른쪽→왼쪽 순차, 삭제는 줄이 접히며 사라짐
 */

type NType = "comment" | "reply" | "reaction" | "comment_like" | "notice";
interface Item {
  id: string;
  type: NType;
  title: string;
  body: string;
  link: string | null;
  groupKey: string | null;
  read: boolean;
  createdAt: string;
}
interface Group {
  key: string;
  type: NType;
  title: string;
  body: string;
  link: string | null;
  ids: string[];
  count: number;
  read: boolean;
  createdAt: string;
}

const ICON: Record<NType, string> = {
  comment: "/icons/toss/chat.svg",
  reply: "/icons/toss/chat.svg",
  reaction: "/icons/toss/heart-red.svg",
  comment_like: "/icons/toss/heart-red.svg",
  notice: "/icons/notice-alert.svg",
};

function timeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 같은 groupKey 는 한 줄로 묶는다(제일 새 것의 제목·본문, 개수 N건). */
function groupItems(items: Item[]): Group[] {
  const map = new Map<string, Group>();
  const order: string[] = [];
  for (const it of items) {
    const key = it.groupKey ? `g:${it.groupKey}` : `i:${it.id}`;
    const g = map.get(key);
    if (!g) {
      map.set(key, { key, type: it.type, title: it.title, body: it.body, link: it.link, ids: [it.id], count: 1, read: it.read, createdAt: it.createdAt });
      order.push(key);
    } else {
      g.ids.push(it.id);
      g.count += 1;
      g.read = g.read && it.read;
    }
  }
  return order.map((k) => map.get(k)!);
}

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const enter = useEntrance("notifications");
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setState("login");
        return;
      }
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    try {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    } catch {
      /* 다음 불러오기에서 바로잡힌다 */
    }
  }, []);

  const groups = useMemo(() => groupItems(items), [items]);
  const shown = useMemo(() => (filter === "unread" ? groups.filter((g) => !g.read) : groups), [groups, filter]);
  const fresh = shown.filter((g) => !g.read);
  const past = shown.filter((g) => g.read);
  const unreadTotal = groups.filter((g) => !g.read).length;

  function open(g: Group) {
    if (!g.read) {
      setItems((prev) => prev.map((it) => (g.ids.includes(it.id) ? { ...it, read: true } : it)));
      post({ action: "read", ids: g.ids });
    }
    if (g.link) router.push(g.link);
  }

  function remove(g: Group) {
    // 줄이 접히며 사라진 뒤 데이터에서 뺀다
    setLeaving((s) => new Set(s).add(g.key));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((it) => !g.ids.includes(it.id)));
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(g.key);
        return n;
      });
    }, 280);
    post({ action: "delete", ids: g.ids });
  }

  async function readAll() {
    setMenuOpen(false);
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    post({ action: "read-all" });
  }

  async function deleteAll() {
    setMenuOpen(false);
    if (!(await uiConfirm("알림을 모두 삭제할까요?", { confirmLabel: "삭제", danger: true }))) return;
    setItems([]);
    post({ action: "delete-all" });
  }

  if (state === "login") return <LoginRequired />;

  let idx = 0;
  const renderRows = (list: Group[], isNew: boolean) =>
    list.map((g) => {
      const i = idx++;
      return (
        <Row
          key={g.key}
          g={g}
          isNew={isNew}
          leaving={leaving.has(g.key)}
          delay={enter && i < 12 ? 0.3 + i * 0.05 : undefined}
          onOpen={() => open(g)}
          onRemove={() => remove(g)}
        />
      );
    });

  return (
    <div className="ntf">
      <div className="ntf-bar">
        <button type="button" className="press ntf-back" onClick={() => router.back()} aria-label="뒤로">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="ntf-head">
        <button type="button" className={`ntf-title${enter ? " qd-a-title" : ""}`} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
          알림
          <svg className={`ntf-caret${menuOpen ? " is-open" : ""}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {unreadTotal > 0 && <p className={`ntf-sub${enter ? " qd-a-sub" : ""}`}>안 읽은 알림 {unreadTotal}개</p>}

        {menuOpen && (
          <>
            <div className="ntf-scrim" onClick={() => setMenuOpen(false)} />
            <div className="ntf-menu" role="menu">
              <button type="button" role="menuitem" className={filter === "all" ? "is-on" : undefined} onClick={() => { setFilter("all"); setMenuOpen(false); }}>전체 알림</button>
              <button type="button" role="menuitem" className={filter === "unread" ? "is-on" : undefined} onClick={() => { setFilter("unread"); setMenuOpen(false); }}>안 읽은 알림만</button>
              <i aria-hidden="true" />
              <button type="button" role="menuitem" onClick={readAll} disabled={unreadTotal === 0}>모두 읽음으로 표시</button>
              <button type="button" role="menuitem" className="is-danger" onClick={deleteAll} disabled={groups.length === 0}>전체 삭제</button>
            </div>
          </>
        )}
      </div>

      {state === "loading" && (
        <div className="ntf-skel" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="ntf-skel-row">
              <span />
              <div><b /><b style={{ width: "62%" }} /></div>
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="ntf-empty">
          <p>알림을 불러오지 못했어요.</p>
          <button type="button" className="mdl-btn is-sub" style={{ flex: "none", padding: "0 26px" }} onClick={() => { setState("loading"); load(); }}>다시 시도</button>
        </div>
      )}

      {state === "ready" && shown.length === 0 && (
        <div className="ntf-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/toss/sleeping.svg" alt="" width={56} height={56} />
          <p>{filter === "unread" ? "안 읽은 알림이 없어요" : "알림이 없어요"}</p>
        </div>
      )}

      {state === "ready" && shown.length > 0 && (
        <div className="ntf-list">
          {fresh.length > 0 && <p className="ntf-sec">새 알림</p>}
          {renderRows(fresh, true)}
          {past.length > 0 && <p className="ntf-sec">{fresh.length > 0 ? "지난 알림" : "알림"}</p>}
          {renderRows(past, false)}
        </div>
      )}

      <style>{`
        .ntf { --ntf-bg: #FFFFFF; --ntf-ink: #191F28; --ntf-sub: #8B95A1; --ntf-body: #6B7684; --ntf-new: #F2F6FC; --ntf-line: rgba(25,31,40,0.06); --ntf-chip: #F2F4F6; --ntf-danger: #F04452;
          min-height: 100vh; background: var(--ntf-bg); padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px)); }
        [data-theme="dark"] .ntf { --ntf-bg: #17171C; --ntf-ink: #F2F4F8; --ntf-sub: #8E96A3; --ntf-body: #A9B0BC; --ntf-new: #1E2433; --ntf-line: rgba(255,255,255,0.07); --ntf-chip: #262832; --ntf-danger: #F25A66; }
        .ntf-bar { position: sticky; top: 0; z-index: 20; background: var(--ntf-bg); padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 0; }
        .ntf-back { width: 44px; height: 44px; border: 0; background: none; color: var(--ntf-ink); display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; }
        .ntf-head { position: relative; padding: 4px 20px 14px; }
        .ntf-title { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 0; font: inherit; font-size: 28px; font-weight: 700; letter-spacing: -0.6px; color: var(--ntf-ink); cursor: pointer; }
        .ntf-caret { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); margin-top: 2px; }
        .ntf-caret.is-open { transform: rotate(180deg); }
        .ntf-sub { margin: 4px 0 0; font-size: 15px; color: var(--ntf-sub); }
        .ntf-scrim { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 30; }
        .ntf-menu {
          position: absolute; z-index: 31; top: 52px; left: 16px; min-width: 210px; padding: 8px; border-radius: 20px;
          background: var(--ntf-bg); box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 0 0 0.5px var(--ntf-line);
          transform-origin: 24px 0; animation: ntfMenu 0.26s cubic-bezier(0.2, 1.2, 0.3, 1) backwards;
        }
        [data-theme="dark"] .ntf-menu { background: #23242C; }
        .ntf-menu button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 13px 14px; border-radius: 13px; font: inherit; font-size: 16px; font-weight: 600; color: var(--ntf-ink); cursor: pointer; animation: mdlSlide 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
        .ntf-menu button:nth-child(1) { animation-delay: 0.04s; } .ntf-menu button:nth-child(2) { animation-delay: 0.08s; }
        .ntf-menu button:nth-child(4) { animation-delay: 0.12s; } .ntf-menu button:nth-child(5) { animation-delay: 0.16s; }
        .ntf-menu button:active { background: var(--ntf-chip); }
        .ntf-menu button.is-on { color: #3182F6; }
        .ntf-menu button.is-danger { color: var(--ntf-danger); }
        .ntf-menu button:disabled { opacity: 0.4; }
        .ntf-menu i { display: block; height: 1px; margin: 6px 10px; background: var(--ntf-line); }
        @keyframes ntfMenu { from { opacity: 0; transform: scale(0.88) translateY(-6px); } to { opacity: 1; transform: none; } }

        .ntf-sec { margin: 8px 20px 6px; font-size: 14px; font-weight: 700; color: var(--ntf-sub); }
        .ntf-list { padding-bottom: 8px; }
        .ntf-rowwrap { position: relative; overflow: hidden; max-height: 220px; transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease; }
        .ntf-rowwrap.is-leaving { max-height: 0; opacity: 0; }
        .ntf-del { position: absolute; top: 0; right: 0; bottom: 0; width: 96px; display: flex; align-items: center; justify-content: center; background: var(--ntf-danger); color: #fff; font-size: 15px; font-weight: 700; }
        .ntf-row {
          position: relative; display: flex; align-items: flex-start; gap: 14px; width: 100%; box-sizing: border-box; padding: 16px 20px; border: 0; text-align: left;
          font-family: inherit; background: var(--ntf-bg); cursor: pointer; touch-action: pan-y; -webkit-tap-highlight-color: transparent;
          transition: background 0.5s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ntf-row.is-new { background: var(--ntf-new); }
        .ntf-row:active { filter: brightness(0.97); }
        .ntf-ic { width: 44px; height: 44px; border-radius: 15px; background: var(--ntf-chip); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .ntf-ic img { width: 26px; height: 26px; display: block; }
        .ntf-main { min-width: 0; flex: 1; }
        .ntf-t { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.4; letter-spacing: -0.3px; color: var(--ntf-ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .ntf-b { margin: 4px 0 0; font-size: 15px; line-height: 1.5; letter-spacing: -0.2px; color: var(--ntf-body); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .ntf-m { margin: 6px 0 0; font-size: 13px; color: var(--ntf-sub); }
        .ntf-m b { font-weight: 600; margin-left: 6px; }
        .ntf-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 90px 20px 0; color: var(--ntf-sub); font-size: 17px; font-weight: 600; animation: mdlRise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
        .ntf-empty p { margin: 0; }
        .ntf-skel { padding: 4px 20px; }
        .ntf-skel-row { display: flex; gap: 14px; padding: 16px 0; }
        .ntf-skel-row span { width: 44px; height: 44px; border-radius: 15px; background: var(--ntf-chip); flex-shrink: 0; }
        .ntf-skel-row div { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
        .ntf-skel-row b { display: block; height: 14px; width: 90%; border-radius: 7px; background: var(--ntf-chip); }
        .ntf-skel-row span, .ntf-skel-row b { animation: ntfShimmer 1.4s ease-in-out infinite; }
        @keyframes ntfShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media (prefers-reduced-motion: reduce) { .ntf-menu, .ntf-menu button, .ntf-empty, .ntf-skel-row span, .ntf-skel-row b { animation: none !important; } }
      `}</style>
    </div>
  );
}

/** 알림 한 줄 — 왼쪽으로 밀면 삭제(80px 넘기면 지움) */
function Row({ g, isNew, leaving, delay, onOpen, onRemove }: { g: Group; isNew: boolean; leaving: boolean; delay?: number; onOpen: () => void; onRemove: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const axis = useRef<"x" | "y" | null>(null);

  function down(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
    axis.current = null;
  }
  function move(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!axis.current) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
    }
    if (axis.current !== "x") return;
    if (!moved.current) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    moved.current = true;
    setDx(Math.max(-140, Math.min(0, ddx)));
  }
  function up() {
    const wasX = axis.current === "x";
    start.current = null;
    if (wasX && dx <= -80) {
      setDx(-140);
      onRemove();
    } else {
      setDx(0);
    }
  }
  return (
    <div className={`ntf-rowwrap qd-a-item${leaving ? " is-leaving" : ""}`} style={delay != null ? { animationDelay: `${delay}s` } : { animation: "none" }}>
      <div className="ntf-del" aria-hidden="true" style={{ opacity: dx < 0 ? 1 : 0 }}>삭제</div>
      <button
        type="button"
        className={`ntf-row${isNew ? " is-new" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => { if (!moved.current) onOpen(); }}
      >
        <span className="ntf-ic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ICON[g.type]} alt="" />
        </span>
        <span className="ntf-main">
          <p className="ntf-t">{g.title}</p>
          {g.body && <p className="ntf-b">{g.body}</p>}
          <p className="ntf-m">
            {timeLabel(g.createdAt)}
            {g.count > 1 && <b>{g.count}건</b>}
          </p>
        </span>
      </button>
    </div>
  );
}
