"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 스타디 프라임 화면의 실제 사용 후기 — 우측에서 좌측으로 끊김 없이 흐르는 캐러셀.
// 원본은 채팅 화면 전체라 여백이 커서, 말풍선만 잘라낸 crop 버전을 띠에 쓴다.
// 탭하면 원본을 전체 화면으로 크게 본다(흐름은 그동안 멈춘다).
const COUNT = 11;
const ids = Array.from({ length: COUNT }, (_, i) => String(i + 1).padStart(2, "0"));

export default function PrimeReviews() {
  const [open, setOpen] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const viewer = open && (
    <div className="pv-dim" onClick={() => setOpen(null)} role="dialog" aria-label="후기 크게 보기">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pv-img" src={`/reviews/r${open}.webp`} alt="스타디 사용 후기" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="pv-close" onClick={() => setOpen(null)} aria-label="닫기">×</button>
    </div>
  );

  return (
    <section className="pr" aria-label="실제 사용 후기">
      <p className="pr-title">실제 사용 후기</p>

      <div className="pr-rail">
        {/* 같은 묶음을 두 벌 이어 붙이고 -50% 로 이동시켜 이음매 없이 반복한다. */}
        <div className={`pr-track${open ? " is-paused" : ""}`}>
          {[...ids, ...ids].map((id, i) => (
            <button key={`${id}-${i}`} type="button" className="pr-item" onClick={() => setOpen(id)} aria-label="후기 크게 보기">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/reviews/crop/r${id}.webp`} alt="" />
            </button>
          ))}
        </div>
      </div>

      {mounted && open && createPortal(viewer, document.body)}

      <style>{`
        .pr { margin: 22px 0 4px; }
        .pr-title { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: var(--c-text-4b); letter-spacing: -0.2px; }
        /* 화면 폭을 넘어 흐르도록 좌우 여백을 상쇄하고, 양끝은 페이드로 부드럽게. */
        .pr-rail {
          overflow: hidden;
          margin: 0 -20px;
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
        }
        .pr-track {
          display: flex;
          align-items: center;
          gap: 10px;
          width: max-content;
          padding: 2px 0;
          animation: pr-marquee 46s linear infinite;
        }
        .pr-track.is-paused { animation-play-state: paused; }
        @keyframes pr-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .pr-item {
          border: none; background: none; padding: 0; margin: 0; cursor: pointer;
          flex-shrink: 0; -webkit-tap-highlight-color: transparent; display: block;
        }
        .pr-item img {
          height: 116px; width: auto; display: block; border-radius: 12px;
          border: 1px solid var(--c-bg-muted-3); background: var(--c-bg);
        }
        .pv-dim {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 3400;
          background: rgba(15,23,42,0.82);
          display: flex; align-items: center; justify-content: center; padding: 18px;
          box-sizing: border-box;
        }
        .pv-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; display: block; }
        .pv-close {
          position: fixed; top: 14px; right: 14px;
          width: 34px; height: 34px; border: none; border-radius: 999px;
          background: rgba(255,255,255,0.2); color: #fff; font-size: 20px; line-height: 1; cursor: pointer;
        }
        @media (prefers-reduced-motion: reduce) { .pr-track { animation: none; } }
      `}</style>
    </section>
  );
}
