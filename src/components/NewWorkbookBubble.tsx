"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { TossBubbleGlass } from "@/components/TossBubble";

/*
 * 홈 "새로운 문제집" 말풍선 — 프리티풀 홈 퀵매칭 말풍선의 디자인·인터랙션을 그대로 옮겼다.
 * 다른 점은 꼬리 방향뿐: 거긴 카드 아래에 떠서 꼬리가 위를 보고, 여긴 과목 버튼 **위**에 떠서
 * 꼬리가 아래(과목 아이콘)를 본다.
 *
 *  · 바탕은 꼬리+몸통 한 장의 유리(TossBubbleGlass) + 뒤 흐림. 흐림이 먹으려면 조상에
 *    filter·opacity<1 이 없어야 해서(Backdrop Root) 투명도 애니는 유리에 직접 건다.
 *  · 등장은 꼬리를 기준으로 납작하게 나타나 제 크기로(globals .qm-bubble, qmBubblePop).
 *  · 누르면 그 과목 문제집 목록으로, × 는 30분 동안 안 뜨게.
 */

const HIDE_KEY = "stady-home-workbook-bubble-hide-until";
const HIDE_MS = 30 * 60 * 1000;
/** 꼬리 끝과 과목 아이콘 사이 간격 */
const GAP = 6;
/** 말풍선 좌우 여백(과목 줄의 좌우 패딩과 같게) */
const INSET = 10;

export default function NewWorkbookBubble({
  containerRef,
  anchorRef,
  categoryId,
  subtitle,
  delay = 600,
}: {
  /** 말풍선 자리를 재는 기준 칸(position: relative) */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 꼬리가 가리킬 대상(과목 버튼) */
  anchorRef: RefObject<HTMLElement | null>;
  categoryId: string;
  subtitle: string;
  delay?: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const [pos, setPos] = useState<{ bottom: number; tailX: number } | null>(null);
  const visible = phase !== "hidden";

  useEffect(() => {
    try {
      if (Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now()) return;
    } catch {
      /* 저장소가 막혔으면 그냥 띄운다 */
    }
    const t = window.setTimeout(() => setPhase("in"), delay);
    return () => window.clearTimeout(t);
  }, [delay]);

  useLayoutEffect(() => {
    if (!visible) return;
    const box = containerRef.current;
    const anchor = anchorRef.current;
    if (!box || !anchor) return;
    const measure = () => {
      // offset 으로 재면 등장 애니(transform)의 영향을 받지 않는다.
      let x = 0;
      let y = 0;
      let el: HTMLElement | null = anchor;
      while (el && el !== box) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      if (el !== box) return;
      setPos({
        // 말풍선 아래끝(꼬리 끝)을 대상 위 GAP 만큼 띄운다.
        bottom: Math.round(box.offsetHeight - y + GAP),
        tailX: Math.round(x + anchor.offsetWidth / 2 - INSET),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(anchor);
    return () => ro.disconnect();
  }, [visible, containerRef, anchorRef]);

  if (!visible || !pos) return null;

  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_MS));
    } catch {
      /* 이번만 닫힌다 */
    }
    setPhase("out");
    window.setTimeout(() => setPhase("hidden"), 200);
  };
  const go = () => router.push(`/category?id=${categoryId}`);

  return (
    <div
      className={`qm-bubble is-tail-down${phase === "out" ? " is-out" : ""}`}
      style={{ bottom: pos.bottom, left: INSET, right: INSET, "--tail-x": `${pos.tailX}px` } as CSSProperties}
      role="link"
      tabIndex={0}
      aria-label={`새로운 문제집, ${subtitle}`}
      onClick={go}
      onKeyDown={(e) => { if (e.key === "Enter") go(); }}
    >
      {/* 그림자(몸통 바깥에만 그려져 반투명한 꼬리에 안 비친다) → 유리(꼬리+몸통 한 장) → 글씨 */}
      <span className="qm-bubble-shadow" aria-hidden="true" />
      <TossBubbleGlass tailX={pos.tailX} side="bottom" />
      <div className="qm-bubble-body">
        <span className="qm-bubble-ic" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="5" width="20" height="18" rx="3.2" fill="#DCE9FF" />
            <path d="M14 5v18" stroke="#3787FF" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 8.2c3.4-1.9 6.6-1.9 10-.2M24 8.2c-3.4-1.9-6.6-1.9-10-.2" stroke="#3787FF" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M20.6 3.4l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" fill="#FFC53D" />
          </svg>
        </span>
        <p className="qm-bubble-title">새로운 문제집이 올라왔어요</p>
        <p className="qm-bubble-sub">{subtitle}</p>
        <button type="button" className="qm-bubble-x" aria-label="닫기" onClick={close}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
