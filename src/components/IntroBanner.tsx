"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 화면 진입 배너 — 딤 위에 이미지 한 장, 우상단 X.
// X 든 딤(배경)이든, 닫으면 hideDays 동안 다시 안 뜬다
// (닫은 시각 + 기간을 저장해 만료로 판단). 딤으로 닫았을 때만 계속 다시 뜨던 걸 맞춘 것.
//
// WebView 규칙: document.body 포털 / inset 단축 금지 / 등장 애니메이션 없음(NoticePopup 과 동일).
// data-gate 를 달아 두면 다른 시트(PrimeReferralSheet 등)가 겹쳐 뜨지 않는다.
export default function IntroBanner({
  image,
  alt,
  storageKey,
  hideDays = 3,
}: {
  image: string;
  alt: string;
  /** 닫은 기록을 저장할 localStorage 키(화면마다 다르게) */
  storageKey: string;
  hideDays?: number;
}) {
  const [open, setOpen] = useState(false);
  // 이미지의 가로/세로 비 — 화면이 낮을 때 카드 폭을 줄이는 데 쓴다.
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(storageKey) || 0);
    } catch {
      until = 0;
    }
    if (until > Date.now()) return;
    // 다른 게이트(옵시디언 인트로 스플래시·공지 팝업 등)가 떠 있으면 닫힐 때까지 기다렸다 뜬다.
    // 이펙트 본문에서 바로 setState 하지 않는다(React Compiler 가 막는다) — 콜백으로 넘긴다.
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!document.querySelector("[data-gate]")) {
        setOpen(true);
        return;
      }
      if (++tries < 100) t = setTimeout(tick, 800); // 최대 80초 대기
    };
    // 첫 검사를 한 박자 늦춘다 — 같은 프레임에 뜨는 스플래시가 아직 DOM 에 없을 수 있다.
    t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, [storageKey]);

  function closeForDays() {
    try {
      localStorage.setItem(storageKey, String(Date.now() + hideDays * 24 * 60 * 60 * 1000));
    } catch {
      /* 저장 못 해도 닫기는 된다 */
    }
    setOpen(false);
  }

  if (!open || typeof document === "undefined") return null;

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
          // 가로모드처럼 화면이 낮을 때 카드가 잘려 X 가 화면 밖으로 나가지 않게 폭을 줄인다.
          maxWidth: ratio ? `min(340px, calc((100dvh - 48px) * ${ratio}))` : 340,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
          }}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 32 }}
        />
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
