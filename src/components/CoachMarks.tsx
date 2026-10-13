"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 첫 진입 튜토리얼(코치마크) — 미드나잇 퀸 견본.
 * 화면을 어둡게 깔고 짚는 칸만 뚫어 밝게 + 누르는 손 + 강조 설명 + 점선 화살표. 아무 데나 누르면 다음.
 * 짚을 칸은 화면 쪽에 data-tour="이름" 을 달고 steps 의 sel 로 가리킨다(없으면 그 단계는 건너뜀).
 * 다 보거나 건너뛰면 이 기기에 'stady:tour:<id>' = done (다시 안 뜸). 문구를 크게 바꿀 땐 id 를 올려 다시 보여 준다.
 * 공지·소개 팝업 등 [data-gate] 가 떠 있는 동안은 기다렸다가 닫히면 뜨고, 떠 있는 동안엔 다른 팝업이 겹쳐 뜨지 않게 자신도 data-gate 를 단다.
 */
export type TourStep = { sel: string; text: ReactNode; sub?: ReactNode; pad?: number; radius?: number };

const seenKey = (id: string) => `stady:tour:${id}`;
const isDone = (id: string) => {
  try {
    return localStorage.getItem(seenKey(id)) === "done";
  } catch {
    return true; // 저장소를 못 쓰면 매번 뜨는 것보다 안 뜨는 쪽이 낫다
  }
};
const markDone = (id: string) => {
  try {
    localStorage.setItem(seenKey(id), "done");
  } catch {
    /* 저장 막힘 */
  }
};

type Rect = { x: number; y: number; w: number; h: number };

export default function CoachMarks({ id, steps }: { id: string; steps: TourStep[] }) {
  const [i, setI] = useState(-1); // -1 = 아직 안 뜸
  const [rect, setRect] = useState<Rect | null>(null);
  const [vh, setVh] = useState(800);

  // 시작 — 첫 칸이 그려지고(데이터 로딩) 다른 팝업(data-gate)이 모두 닫힌 뒤에 뜬다.
  useEffect(() => {
    if (isDone(id)) return;
    let tries = 0;
    let calm = 0;
    const timer = window.setInterval(() => {
      tries++;
      const gated = !!document.querySelector("[data-gate]:not([data-gate=\"coach\"])");
      const ready = steps.some((s) => document.querySelector(s.sel));
      calm = !gated && ready ? calm + 1 : 0;
      // 두 번 연속(≈0.9초) 조용해야 뜬다 — 팝업이 닫히는 애니메이션·다음 팝업이 뜨는 사이를 건너뛰기 위해
      if (calm >= 2) {
        window.clearInterval(timer);
        setI(0);
      } else if (tries > 200) {
        window.clearInterval(timer);
      }
    }, 450);
    return () => window.clearInterval(timer);
  }, [id, steps]);

  const finish = useCallback(() => {
    markDone(id);
    setI(-1);
    setRect(null);
  }, [id]);

  const measure = useCallback(() => {
    if (i < 0) return;
    const s = steps[i];
    const el = s && (document.querySelector(s.sel) as HTMLElement | null);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = s.pad ?? 6;
    const vhNow = window.innerHeight;
    // 긴 칸은 윗부분만 비춘다 — 설명·손이 비춘 칸을 덮지 않게
    const next = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: Math.min(r.height + pad * 2, vhNow * 0.36) };
    setVh((v) => (v === vhNow ? v : vhNow));
    // 바뀐 게 있을 때만 다시 그린다(매 프레임 재기 때문)
    setRect((cur) =>
      cur && Math.abs(cur.x - next.x) < 0.5 && Math.abs(cur.y - next.y) < 0.5 && Math.abs(cur.w - next.w) < 0.5 && Math.abs(cur.h - next.h) < 0.5
        ? cur
        : next
    );
  }, [i, steps]);

  // 단계가 바뀌면 그 칸을 화면 가운데로 굴리고 잰다(없는 칸은 건너뜀)
  useEffect(() => {
    if (i < 0) return;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      if (i >= steps.length) {
        finish();
        return;
      }
      const el = document.querySelector(steps[i].sel) as HTMLElement | null;
      if (!el) {
        setI((v) => v + 1);
        return;
      }
      const r = el.getBoundingClientRect();
      const vhNow = window.innerHeight;
      if (r.top < 90 || r.bottom > vhNow - 130) {
        const want = r.height > vhNow * 0.5 ? r.top + window.scrollY - 110 : r.top + window.scrollY - (vhNow - r.height) / 2;
        window.scrollTo({ top: Math.max(0, want), behavior: "instant" as ScrollBehavior });
      }
      t2 = setTimeout(measure, 30);
    }, 0);
    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
    };
  }, [i, steps, measure, finish]);

  // 떠 있는 동안 매 프레임 다시 잰다 — 등장 애니메이션·늦게 그려지는 데이터·스크롤로 칸이 움직여도 따라간다
  useEffect(() => {
    if (i < 0) return;
    let raf = 0;
    const loop = () => {
      measure();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [i, measure]);

  // 튜토리얼 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (i < 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [i]);

  if (i < 0 || i >= steps.length || typeof document === "undefined") return null;
  const s = steps[i];
  const last = i === steps.length - 1;
  const below = rect ? rect.y + rect.h / 2 < vh * 0.5 : true; // 칸이 위쪽이면 설명은 아래에
  const cx = rect ? rect.x + rect.w / 2 : 0;
  const ctrlTop = !!rect && rect.y > vh * 0.62; // 칸이 화면 아래(하단 탭 등)면 '다음' 버튼을 위로

  return createPortal(
    <div
      className="coach"
      data-gate="coach"
      onClick={() => (last ? finish() : setI(i + 1))}
      role="dialog"
      aria-modal="true"
      aria-label="사용 안내"
    >
      {/* 뚫린 칸 — 바깥은 어둡게 */}
      {rect ? (
        <div
          className="coach-hole"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: s.radius ?? 18 }}
        />
      ) : (
        <div className="coach-dim" />
      )}

      {rect && (
        <>
          {/* 누르는 손 — 칸 가운데 아래쪽 */}
          <div key={`hand-${i}`} className="coach-hand-wrap" style={{ left: cx - 20, top: Math.min(rect.y + rect.h - 26, vh - 120) }}>
            <span className="coach-tap" />
            <span className="coach-dot" />
            <TapHand />
          </div>

          {/* 설명 + 점선 화살표 */}
          <div
            key={`txt-${i}`}
            className="coach-text"
            style={below ? { top: Math.min(rect.y + rect.h + 64, vh - 240) } : { bottom: Math.max(vh - rect.y + 22, ctrlTop ? 40 : 150) }}
          >
            {below && <DashArrow up />}
            <p className="coach-title">{s.text}</p>
            {s.sub && <p className="coach-sub">{s.sub}</p>}
            {!below && <DashArrow />}
          </div>
        </>
      )}

      {/* 위 — 건너뛰기 / 아래 — 진행 점 + 이전·다음 */}
      <button
        type="button"
        className="coach-skip"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        건너뛰기
      </button>
      <div className={`coach-ctrl${ctrlTop ? " is-top" : ""}`}>
        <div className="coach-dots">
          {steps.map((_, j) => (
            <span key={j} className={j === i ? "on" : ""} />
          ))}
        </div>
        <div className="coach-btns">
          {i > 0 && (
            <button
              type="button"
              className="coach-btn is-sub"
              onClick={(e) => {
                e.stopPropagation();
                setI(i - 1);
              }}
            >
              이전
            </button>
          )}
          <button
            type="button"
            className="coach-btn is-main"
            onClick={(e) => {
              e.stopPropagation();
              if (last) finish();
              else setI(i + 1);
            }}
          >
            {last ? "시작하기" : `다음 ${i + 1}/${steps.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** 강조 글자(파란빛) */
export const K = ({ children }: { children: ReactNode }) => <b className="coach-k">{children}</b>;

/** 누르는 손(흰 선) */
function TapHand() {
  return (
    <svg className="coach-hand" width="46" height="54" viewBox="0 0 46 54" fill="none" aria-hidden="true">
      <path
        d="M13 26V7.5a3.5 3.5 0 0 1 7 0V22l.1-3.6a3.4 3.4 0 0 1 6.8 0V23l.1-2.3a3.4 3.4 0 0 1 6.8 0V25l.1-1.2a3.3 3.3 0 0 1 6.6 0V35c0 8.8-6.2 15-14.6 15h-2.4c-4.6 0-8.3-2.3-11-6.1L4.4 33.6a3.3 3.3 0 0 1 5-4.2L13 33V26Z"
        fill="#fff"
        stroke="#1a1d24"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M20 22v8M27 23v7M33.8 25v6" stroke="#1a1d24" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 점선 휘어진 화살표 — up 이면 위(칸)를 가리킴 */
function DashArrow({ up }: { up?: boolean }) {
  return (
    <svg className={up ? "coach-arrow" : "coach-arrow is-down"} width="40" height="34" viewBox="0 0 40 34" fill="none" aria-hidden="true">
      <path d="M26 31C14 28 10 18 16 6" stroke="#fff" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
      <path d="M11 9l5-5 4 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
