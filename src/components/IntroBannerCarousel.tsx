"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface IntroSlide {
  image: string;
  alt: string;
}

// 앱 첫 진입 배너 — 딤 위 가운데에서 여러 장이 2초마다 넘어간다(손으로 밀어서도 넘길 수 있다).
// X 든 딤(배경)이든, 닫으면 hideDays 동안 다시 안 뜬다.
//
// ⚠️ 스크롤 스냅 + scrollTo({behavior:"smooth"}) 로 만들면 WebView 에서 스냅과 부드러운 스크롤이
// 서로 싸워 "움찔거리기만 하고 안 넘어가는" 증상이 난다. 그래서 스크롤 대신 **transform 으로만**
// 넘긴다(트랙을 -index*100% 만큼 밀고 transition 으로 애니메이션). 스와이프는 터치 좌표로 직접 판정.
//
// 다른 [data-gate](공지 팝업 등)가 떠 있으면 닫힐 때까지 기다렸다 뜬다(겹침 방지).
const AUTO_MS = 2000;
const SWIPE_PX = 40;

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
  // 배너 이미지 중 가장 세로로 긴 것의 가로/세로 비. 이 값으로 카드 폭을 줄여
  // 화면이 낮을 때(폰 가로모드) 카드가 위아래로 잘려 X 버튼이 화면 밖으로 나가는 걸 막는다.
  const [ratio, setRatio] = useState<number | null>(null);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(storageKey) || 0);
    } catch {
      until = 0;
    }
    if (until > Date.now()) return;

    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!document.querySelector("[data-gate]")) {
        setOpen(true);
        return;
      }
      if (++tries < 100) timer = setTimeout(tick, 1200); // 최대 2분 대기
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // 2초마다 다음 장(마지막 다음은 처음). 손으로 미는 중에는 멈춘다.
  useEffect(() => {
    if (!open || slides.length < 2) return;
    const t = setInterval(() => {
      if (dragging.current) return;
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [open, slides.length]);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? null;
    dragging.current = true;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const from = startX.current;
    dragging.current = false;
    startX.current = null;
    if (from == null || slides.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? from) - from;
    if (Math.abs(dx) < SWIPE_PX) return;
    setIndex((i) => (dx < 0 ? (i + 1) % slides.length : (i - 1 + slides.length) % slides.length));
  }

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
      onClick={closeForDays}
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2500,
        background: "rgba(15,23,42,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          // 세로 여백(padding 24 × 2)을 뺀 높이에 맞춰 폭을 줄인다 — 가로모드에서도 카드 전체가 보인다.
          maxWidth: ratio ? `min(340px, calc((100dvh - 48px) * ${ratio}))` : 340,
        }}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ overflow: "hidden", borderRadius: 32, touchAction: "pan-y" }}
        >
          <div
            style={{
              display: "flex",
              transform: `translateX(-${index * 100}%)`,
              transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {slides.map((s) => (
              <div key={s.image} style={{ flex: "0 0 100%", minWidth: "100%" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.alt}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (!img.naturalHeight) return;
                    const r = img.naturalWidth / img.naturalHeight;
                    setRatio((cur) => (cur === null ? r : Math.min(cur, r)));
                  }}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 12,
            display: "flex", justifyContent: "center", gap: 6,
          }}>
            {slides.map((s, i) => (
              <button
                key={s.image}
                type="button"
                aria-label={`${i + 1}번째 배너`}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 18 : 6, height: 6, borderRadius: 999, border: "none", padding: 0,
                  background: i === index ? "#fff" : "rgba(255,255,255,0.55)",
                  transition: "width 0.2s ease", cursor: "pointer",
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
    </div>,
    document.body
  );
}
