"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface IntroSlide {
  image: string;
  alt: string;
}

// 앱 첫 진입 배너 — 딤 위 가운데에서 여러 장이 2초마다 넘어간다(손으로 밀어서도 넘길 수 있다).
// 우상단 X 를 누르면 hideDays 동안 다시 안 뜬다. 배경을 누르면 이번만 닫힌다.
//
// 공지 팝업 등 다른 [data-gate] 가 떠 있으면 그게 닫힐 때까지 기다렸다 뜬다(겹침 방지).
// WebView 규칙: document.body 포털 / inset 단축 금지 / 등장 애니메이션 없음.
const AUTO_MS = 2000;

export default function IntroBannerCarousel({
  slides,
  storageKey,
  hideDays = 3,
}: {
  slides: IntroSlide[];
  storageKey: string;
  hideDays?: number;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // 다른 팝업이 사라질 때까지 기다렸다가 연다.
  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(storageKey) || 0);
    } catch {
      until = 0;
    }
    if (until > Date.now()) return;

    let tries = 0;
    const tick = () => {
      // 공지 팝업·닉네임 게이트 등이 떠 있으면 다음 기회에.
      if (!document.querySelector("[data-gate]")) {
        setOpen(true);
        return;
      }
      if (++tries < 100) timer = setTimeout(tick, 1200); // 최대 2분 대기
    };
    let timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // 2초마다 다음 장으로(마지막 다음은 처음으로).
  useEffect(() => {
    if (!open || slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_MS);
    return () => clearInterval(t);
  }, [open, slides.length]);

  // index 가 바뀌면 트랙을 그 장으로 스크롤(손으로 민 경우는 onScroll 이 index 를 맞춘다).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.clientWidth * index;
    if (Math.abs(el.scrollLeft - left) > 4) el.scrollTo({ left, behavior: "smooth" });
  }, [index, open]);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setIndex((prev) => (prev === i ? prev : i));
  }, []);

  function closeForDays() {
    try {
      localStorage.setItem(storageKey, String(Date.now() + hideDays * 24 * 60 * 60 * 1000));
    } catch {
      /* 저장 못 해도 닫기는 된다 */
    }
    setOpen(false);
  }

  if (!open || typeof document === "undefined" || slides.length === 0) return null;

  return createPortal(
    <div
      data-gate="intro-banner"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2500,
        background: "rgba(15,23,42,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, boxSizing: "border-box",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 340 }}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="ibc-track"
          style={{
            display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
            borderRadius: 32, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
          }}
        >
          {slides.map((s) => (
            <div key={s.image} style={{ flex: "0 0 100%", scrollSnapAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.alt} style={{ width: "100%", height: "auto", display: "block", borderRadius: 32 }} />
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 12,
            display: "flex", justifyContent: "center", gap: 6, pointerEvents: "none",
          }}>
            {slides.map((s, i) => (
              <span
                key={s.image}
                style={{
                  width: i === index ? 18 : 6, height: 6, borderRadius: 999,
                  background: i === index ? "#fff" : "rgba(255,255,255,0.55)",
                  transition: "width 0.2s ease",
                }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={closeForDays}
          aria-label={`닫기 (${hideDays}일 동안 안 보기)`}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 34, height: 34, borderRadius: 999, border: "none", cursor: "pointer",
            background: "rgba(15,23,42,0.5)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <style>{`.ibc-track::-webkit-scrollbar { display: none; } .ibc-track { scrollbar-width: none; }`}</style>
    </div>,
    document.body
  );
}
