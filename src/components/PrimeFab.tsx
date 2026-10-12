"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 스타디 프라임 구독 — 하단 네비 바로 위에 떠 있는 플로팅 알약(홈에서만 마운트된다).
 *  · 헤더가 아니라 네비 위. 네비 높이(안전영역 포함, 스크롤로 접히면 낮아짐)를 재서 늘 그 위 12px 에 붙는다.
 *  · body 포털 — 홈 블록들이 등장 애니메이션(transform)을 가져 fixed 가 그 안에 갇히지 않게.
 *  · 처음엔 잠깐 뒤에 스프링으로 튀어 오른다(프리티풀 말풍선처럼 '뚝' 나타나지 않게).
 */
export default function PrimeFab({ onClick }: { onClick: () => void }) {
  const [bottom, setBottom] = useState(94);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>(".main-nav");
    if (!nav) return;
    const measure = () => setBottom(Math.round(nav.getBoundingClientRect().height) + 12);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <>
      <button
        type="button"
        className="press prime-fab"
        style={{ bottom }}
        onClick={onClick}
        aria-label="스타디 프라임 구독하기"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/stady-mark.webp" alt="" className="prime-fab-mark" />
        프라임 구독
      </button>
      <style>{`
        /* 글래스 — 뒤 화면이 비치는 프로스티드 알약. 흐림(backdrop-filter)은 조상에 filter·transform 이 없어야 먹는다 → body 포털로 해결.
           투명도 애니는 알약 자신에 건다(조상이 아니라서 흐림이 유지된다). */
        .prime-fab {
          position: fixed; right: 16px; z-index: 55; height: 48px; padding: 0 20px 0 14px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap;
          font-family: inherit; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: #2447C7;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.66) 0%, rgba(218, 232, 255, 0.46) 55%, rgba(226, 220, 255, 0.5) 100%);
          -webkit-backdrop-filter: blur(16px) saturate(1.7); backdrop-filter: blur(16px) saturate(1.7);
          border: 1px solid rgba(255, 255, 255, 0.78);
          box-shadow: 0 12px 30px rgba(60, 100, 210, 0.26), 0 2px 8px rgba(60, 100, 210, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(120, 150, 255, 0.18);
          -webkit-tap-highlight-color: transparent;
          animation: primeFabIn 0.7s cubic-bezier(0.2, 1.4, 0.3, 1) 0.9s backwards;
          transition: bottom 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-theme="dark"] .prime-fab {
          color: #C5D7FF;
          background: linear-gradient(135deg, rgba(96, 112, 190, 0.42) 0%, rgba(60, 76, 150, 0.34) 55%, rgba(110, 90, 190, 0.38) 100%);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(120, 140, 255, 0.16);
        }
        .prime-fab:active { transform: scale(0.94); }
        .prime-fab-mark { width: 22px; height: 22px; object-fit: contain; display: block; flex-shrink: 0; }
        @keyframes primeFabIn { from { opacity: 0; transform: translateY(24px) scale(0.6); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .prime-fab { animation: none; } }
      `}</style>
    </>,
    document.body
  );
}
