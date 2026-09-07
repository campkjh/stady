"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 스타디 프라임 화면의 실제 사용 후기 — 인스타 DM 후기를 2열로 쌓아 보여준다.
// 원본은 채팅 화면 전체라 여백이 커서, 말풍선만 잘라낸 crop 버전을 격자에 쓴다.
// 탭하면 원본(전체 화면)으로 크게 본다.
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
    <section className="pr">
      <p className="pr-title">실제 사용 후기</p>
      <p className="pr-sub">스타디로 공부한 학생들이 직접 보내준 이야기예요.</p>

      <div className="pr-grid">
        {ids.map((id) => (
          <button key={id} type="button" className="pr-item" onClick={() => setOpen(id)} aria-label="후기 크게 보기">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/reviews/crop/r${id}.webp`} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {mounted && open && createPortal(viewer, document.body)}

      <style>{`
        .pr { margin-top: 26px; }
        .pr-title { margin: 0; font-size: 16px; font-weight: 800; color: var(--c-text-b); }
        .pr-sub { margin: 6px 0 14px; font-size: 13px; color: var(--c-text-4b); font-weight: 500; }
        /* 2열 — 높이가 제각각이라 CSS columns 로 촘촘히 쌓는다(벽돌형). */
        .pr-grid { column-count: 2; column-gap: 10px; }
        .pr-item {
          display: block; width: 100%; margin: 0 0 10px; padding: 0; border: none;
          background: none; cursor: pointer; break-inside: avoid; -webkit-column-break-inside: avoid;
          -webkit-tap-highlight-color: transparent;
        }
        .pr-item img {
          width: 100%; height: auto; display: block; border-radius: 12px;
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
      `}</style>
    </section>
  );
}
