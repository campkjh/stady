"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * 퀴즈 화면의 떠다니는 툴박스(글래스).
 *  · 접힌 상태: 시계(타이머) 알약 하나. 누르면 도구들이 위(또는 아래)로 촤라락 펼쳐진다.
 *  · 알약을 끌어서 원하는 곳에 둔다 — 놓으면 가까운 왼쪽/오른쪽 가장자리에 붙고, 위치는 기기에 저장한다.
 *  · 화면 위쪽에 있으면 아래로, 아래쪽에 있으면 위로 펼쳐지고, 왼쪽에 있으면 라벨이 오른쪽에 붙는다.
 */
export interface ToolboxItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** 켜짐 상태(색 강조) */
  active?: boolean;
  /** 강조 색(켜졌을 때 링·라벨 — 아이콘의 대표색) */
  tint?: string;
  /** 아이콘 동그라미 배경(아이콘 색에 맞춘 연한 틴트) */
  bg?: string;
  onClick: () => void;
}

const STORAGE_KEY = "stady:quiz-toolbox";
const MARGIN = 12;
const TOP_MIN = 64; // 위 헤더 아래로
const BOTTOM_PAD = 96; // 아래 O/X 버튼 영역 위로

type Side = "l" | "r";
interface Saved { side: Side; y: number } // y = 화면 높이 대비 비율(0~1)

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if ((v.side === "l" || v.side === "r") && typeof v.y === "number") return v;
  } catch {
    /* 저장소 막힘 */
  }
  return null;
}

export default function QuizToolbox({ timer, items }: { timer: ReactNode; items: ToolboxItem[] }) {
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const [side, setSide] = useState<Side>("r");
  const [yRatio, setYRatio] = useState(0.26); // 처음엔 오른쪽 위쪽
  const [w, setW] = useState(110);
  const [vw, setVw] = useState(412);
  const [vh, setVh] = useState(800);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean; id: number } | null>(null);

  // 저장된 위치 복원 + 화면 크기 추적
  useEffect(() => {
    const saved = readSaved();
    const t = setTimeout(() => {
      if (saved) {
        setSide(saved.side);
        setYRatio(saved.y);
      }
    }, 0);
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (fabRef.current) setW(fabRef.current.offsetWidth);
    };
    const t2 = setTimeout(measure, 0);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const H = 44;
  const clampY = useCallback((y: number) => Math.max(TOP_MIN, Math.min(vh - H - BOTTOM_PAD, y)), [vh]);
  const restX = side === "l" ? MARGIN : vw - w - MARGIN;
  const restY = clampY(yRatio * vh);
  const x = drag ? drag.x : restX;
  const y = drag ? drag.y : restY;
  const up = y + H / 2 > vh / 2; // 아래쪽에 있으면 위로 펼친다

  const close = useCallback(() => {
    setPhase((p) => (p === "open" ? "closing" : p));
    window.setTimeout(() => setPhase((p) => (p === "closing" ? "closed" : p)), 240);
  }, []);

  // Esc 로 닫기
  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { px: e.clientX, py: e.clientY, ox: rect.left, oy: rect.top, moved: false, id: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 WebView 는 캡처를 못 잡는다 — 그래도 끌기는 된다 */
    }
  }
  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 6) return; // 살짝 눌러 떨리는 건 클릭으로 본다
    if (!d.moved) {
      d.moved = true;
      if (phase === "open") setPhase("closed"); // 끌기 시작하면 접는다
    }
    setDrag({
      x: Math.max(4, Math.min(vw - w - 4, d.ox + dx)),
      y: Math.max(8, Math.min(vh - H - 8, d.oy + dy)),
    });
  }
  function onUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      // 클릭 = 펼치기/접기
      if (phase === "open") close();
      else setPhase("open");
      return;
    }
    // 놓은 자리에서 가까운 가장자리로 붙는다
    const rect = e.currentTarget.getBoundingClientRect();
    const nextSide: Side = rect.left + w / 2 < vw / 2 ? "l" : "r";
    const ny = clampY(rect.top) / vh;
    setSide(nextSide);
    setYRatio(ny);
    setDrag(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ side: nextSide, y: ny }));
    } catch {
      /* 저장 못 해도 이번 화면에선 유지 */
    }
  }

  const shown = phase !== "closed";
  const ordered = up ? [...items].reverse() : items; // 접힌 알약에서 가까운 것부터 차례로

  return (
    <>
      {phase === "open" && <div className="tb-backdrop" onPointerDown={close} />}
      <div
        className={`tb${drag ? " is-dragging" : ""}${side === "l" ? " is-left" : " is-right"}`}
        style={{ left: x, top: y }}
      >
        <button
          ref={fabRef}
          type="button"
          className="tb-fab"
          aria-label="도구 상자"
          aria-expanded={phase === "open"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {timer}
          <svg className={`tb-caret${phase === "open" ? " is-open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {shown && (
          <div className={`tb-items${up ? " is-up" : " is-down"}${phase === "closing" ? " is-closing" : ""}`} style={{ ["--n" as string]: ordered.length }}>
            {ordered.map((it, i) => (
              <div className="tb-row" key={it.key} style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  className={`tb-item${it.active ? " is-on" : ""}`}
                  style={{ ["--tb-tint" as string]: it.tint ?? "#3182f6", ["--tb-bg" as string]: it.bg ?? "transparent" } as React.CSSProperties}
                  aria-label={it.label}
                  aria-pressed={it.active}
                  onClick={() => {
                    it.onClick();
                  }}
                >
                  <span className="tb-label">{it.label}</span>
                  <span className="tb-ico">{it.icon}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
