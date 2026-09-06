"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 커뮤니티 상단 "스타디 사용 후기" — 인스타 하이라이트형 원형 목록 + 스토리 뷰어.
// 뷰어: 상단 진행바, 좌/우 탭으로 넘기기, 자동 넘김, 누르고 있으면 일시정지.
interface Slide { id: string; imageUrl: string }
interface Highlight { id: string; title: string; coverUrl: string; slides: Slide[] }

const SLIDE_MS = 5000;

export default function StoryHighlights() {
  const [items, setItems] = useState<Highlight[]>([]);
  const [openAt, setOpenAt] = useState<number | null>(null); // 열린 하이라이트 index
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0); // 0~1 현재 슬라이드 진행률
  const rafRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/stories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(Array.isArray(d?.highlights) ? d.highlights : []))
      .catch(() => {});
  }, []);

  const current = openAt === null ? null : items[openAt] ?? null;

  const close = useCallback(() => {
    setOpenAt(null);
    setSlideIdx(0);
    setProgress(0);
  }, []);

  // 다음 슬라이드 → 하이라이트 끝이면 다음 하이라이트 → 마지막이면 닫기
  const next = useCallback(() => {
    if (openAt === null) return;
    const h = items[openAt];
    if (!h) return close();
    if (slideIdx + 1 < h.slides.length) {
      setSlideIdx((i) => i + 1);
      setProgress(0);
      return;
    }
    if (openAt + 1 < items.length) {
      setOpenAt(openAt + 1);
      setSlideIdx(0);
      setProgress(0);
      return;
    }
    close();
  }, [openAt, slideIdx, items, close]);

  const prev = useCallback(() => {
    if (openAt === null) return;
    if (slideIdx > 0) {
      setSlideIdx((i) => i - 1);
      setProgress(0);
      return;
    }
    if (openAt > 0) {
      const p = openAt - 1;
      setOpenAt(p);
      setSlideIdx(Math.max(0, (items[p]?.slides.length ?? 1) - 1));
      setProgress(0);
    }
  }, [openAt, slideIdx, items]);

  // 자동 넘김 — rAF 로 진행률을 채우고 다 차면 next().
  useEffect(() => {
    if (openAt === null || paused) return;
    let start: number | null = null;
    const from = progress;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, from + (t - start) / SLIDE_MS);
      setProgress(p);
      if (p >= 1) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // progress 를 의존성에 넣으면 매 프레임 재시작한다 — 슬라이드/일시정지 변화에만 반응.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAt, slideIdx, paused, next]);

  // 열려 있는 동안 ESC 로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (openAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openAt, close, next, prev]);

  if (items.length === 0) return null;

  const viewer = current && (
    <div className="sh-viewer" role="dialog" aria-label={`${current.title} 후기`}>
      {/* 진행바 */}
      <div className="sh-bars">
        {current.slides.map((s, i) => (
          <span key={s.id} className="sh-bar">
            <i style={{ width: i < slideIdx ? "100%" : i === slideIdx ? `${progress * 100}%` : "0%" }} />
          </span>
        ))}
      </div>

      <div className="sh-top">
        <span className="sh-top-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.coverUrl} alt="" />
        </span>
        <span className="sh-top-title">{current.title}</span>
        <button type="button" className="sh-close" onClick={close} aria-label="닫기">×</button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sh-image" src={current.slides[slideIdx]?.imageUrl} alt="" />

      {/* 좌/우 탭 영역 — 누르고 있으면 일시정지 */}
      <button
        type="button" className="sh-zone sh-zone-l" aria-label="이전"
        onClick={prev}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
      />
      <button
        type="button" className="sh-zone sh-zone-r" aria-label="다음"
        onClick={next}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
      />
    </div>
  );

  return (
    <section className="sh" aria-label="스타디 사용 후기">
      <div className="sh-rail">
        {items.map((h, i) => (
          <button key={h.id} type="button" className="sh-item" onClick={() => { setOpenAt(i); setSlideIdx(0); setProgress(0); }}>
            <span className="sh-ring">
              <span className="sh-ring-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.coverUrl} alt="" />
              </span>
            </span>
            <span className="sh-label">{h.title}</span>
          </button>
        ))}
      </div>

      {mounted && openAt !== null && createPortal(viewer, document.body)}

      <style>{`
        .sh { margin: 0 0 14px; }
        .sh-rail { display: flex; gap: 14px; overflow-x: auto; scrollbar-width: none; padding: 2px 0 4px; }
        .sh-rail::-webkit-scrollbar { display: none; }
        .sh-item { border: none; background: none; padding: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 68px; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
        /* 인스타 하이라이트처럼 그라데이션 링 + 안쪽 여백 */
        .sh-ring { width: 64px; height: 64px; border-radius: 999px; padding: 2.5px; box-sizing: border-box; background: linear-gradient(45deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%); display: block; }
        .sh-ring-inner { display: block; width: 100%; height: 100%; border-radius: 999px; padding: 2.5px; box-sizing: border-box; background: var(--c-bg); }
        .sh-ring-inner img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; display: block; }
        .sh-label { font-size: 11.5px; font-weight: 600; color: var(--c-text-3b); max-width: 68px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .sh-viewer { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 3200; background: #000; display: flex; align-items: center; justify-content: center; }
        .sh-image { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
        .sh-bars { position: absolute; top: calc(8px + env(safe-area-inset-top, 0px)); left: 8px; right: 8px; display: flex; gap: 4px; z-index: 2; }
        .sh-bar { flex: 1; height: 2.5px; border-radius: 999px; background: rgba(255,255,255,0.34); overflow: hidden; }
        .sh-bar i { display: block; height: 100%; background: #fff; }
        .sh-top { position: absolute; top: calc(20px + env(safe-area-inset-top, 0px)); left: 12px; right: 12px; display: flex; align-items: center; gap: 8px; z-index: 2; }
        .sh-top-cover { width: 30px; height: 30px; border-radius: 999px; overflow: hidden; flex-shrink: 0; }
        .sh-top-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sh-top-title { color: #fff; font-size: 13.5px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
        .sh-close { margin-left: auto; width: 32px; height: 32px; border: none; border-radius: 999px; background: rgba(255,255,255,0.18); color: #fff; font-size: 20px; line-height: 1; cursor: pointer; }
        .sh-zone { position: absolute; top: 0; bottom: 0; width: 34%; border: none; background: none; cursor: pointer; z-index: 1; -webkit-tap-highlight-color: transparent; }
        .sh-zone-l { left: 0; }
        .sh-zone-r { right: 0; width: 66%; }
      `}</style>
    </section>
  );
}
