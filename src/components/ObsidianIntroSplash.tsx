"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 옵시디언(타이머) 첫 진입 스플래시 — 화면이 천천히 어두워진 뒤 크리스탈 영상이
// 서서히 밝아지며 떠오르고, 그 위에 보라 그라데이션 타이틀이 올라온다.
// 영상이 끝나거나(7초) 아무 데나 누르면 닫히고, 한 기기에서 한 번만 나온다.
//
// ⚠️ 자동재생: 소리까지 내는 게 목표라 먼저 음소거 없이 play() 를 시도하고,
//    브라우저가 막으면(사용자 제스처 없는 소리 재생 금지) 음소거로 되돌려 다시 튼다.
//    그래도 막히는 기기가 있어서 poster 를 깔아두고, 재생 여부와 무관하게
//    HOLD_MS 뒤 자동으로 닫는다(영상이 안 나와도 앱이 멈추지 않게).
// 연출을 고칠 때마다 뒤 번호를 올린다 — 이미 본 사람에게도 한 번 더 나온다.
const SEEN_KEY = "obsidian_intro_splash_v2";
const HOLD_MS = 7600; // 영상 7초 + 여운
const FADE_MS = 700;

// 소리 있는 재생을 먼저 시도하고, 막히면 음소거로 재생한다.
function playWithSound(v: HTMLVideoElement | null) {
  if (!v) return;
  v.muted = false;
  v.volume = 1;
  v.play().catch(() => {
    v.muted = true;
    v.play().catch(() => {
      /* 그래도 막히면 poster 가 대신 보인다 */
    });
  });
}

export default function ObsidianIntroSplash() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let seen = "1"; // 저장소를 못 읽으면 안 띄우는 쪽이 안전하다
    try {
      seen = localStorage.getItem(SEEN_KEY) || "";
    } catch {
      seen = "1";
    }
    if (seen) return;
    // 공지 팝업 같은 다른 게이트가 떠 있으면 양보한다(첫 진입 배너는 스플래시 뒤에 서니 제외).
    if (document.querySelector('[data-gate]:not([data-gate="intro-banner"])')) return;
    const t = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* 저장 못 해도 이번 진입에선 닫힌다 */
    }
    setClosing(true);
    setTimeout(() => setOpen(false), FADE_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(close, HOLD_MS);
    return () => clearTimeout(t);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    playWithSound(videoRef.current);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`obsplash${closing ? " is-closing" : ""}`}
      data-gate="obsidian-splash"
      onClick={close}
      role="presentation"
    >
      <video
        ref={videoRef}
        className="obsplash-video"
        src="/intro/obsidian-intro.mp4"
        poster="/intro/obsidian-intro-poster.jpg"
        playsInline
        autoPlay
        preload="auto"
        onEnded={close}
        // 마운트 직후의 play() 는 아직 로드 전이라 거절될 수 있다 — 재생 가능해지면 한 번 더.
        onCanPlay={(e) => {
          if (e.currentTarget.paused) playWithSound(e.currentTarget);
        }}
      />
      <div className="obsplash-veil" />
      <div className="obsplash-copy">
        <span className="obsplash-glow" aria-hidden="true" />
        <p className="obsplash-title">시간을 기록하는 옵시디언</p>
      </div>
      <button type="button" className="obsplash-skip" onClick={close}>
        건너뛰기
      </button>

      {/* 스플래시는 영상 위에 얹는 연출 화면이라 라이트/다크 공통으로 어둡게 간다.
          (테마 토큰 대신 고정색을 쓰는 유일한 화면) */}
      <style jsx>{`
        .obsplash {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 3000;
          background: #05010f;
          overflow: hidden;
          animation: obsplash-dim 1000ms ease-out both;
          transition: opacity ${FADE_MS}ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .obsplash.is-closing {
          opacity: 0;
        }
        .obsplash-video {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          transform: translate(-50%, -50%);
          object-fit: cover;
          animation: obsplash-rise 2400ms cubic-bezier(0.16, 1, 0.3, 1) 850ms both;
        }
        /* 정사각 영상이 화면 위아래로 잘려 보이지 않게 가장자리를 어둠으로 녹인다 */
        .obsplash-veil {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background:
            radial-gradient(120% 62% at 50% 42%, rgba(5, 1, 15, 0) 38%, rgba(5, 1, 15, 0.72) 78%, #05010f 100%),
            linear-gradient(180deg, rgba(5, 1, 15, 0.55) 0%, rgba(5, 1, 15, 0) 26%, rgba(5, 1, 15, 0.2) 62%, rgba(5, 1, 15, 0.92) 100%);
          animation: obsplash-fade 1600ms ease 900ms both;
          pointer-events: none;
        }
        .obsplash-copy {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: calc(96px + env(safe-area-inset-bottom, 0px));
          animation: obsplash-title 1500ms cubic-bezier(0.16, 1, 0.3, 1) 1600ms both;
        }
        /* 글자 뒤 보라 번짐 — 글자 자체에 filter 를 걸면 일부 웹뷰에서
           background-clip:text 가 깨져 글자가 통째로 안 보인다. 그래서 층을 나눈다. */
        .obsplash-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 78%;
          height: 150%;
          transform: translate(-50%, -50%);
          background: radial-gradient(60% 50% at 50% 50%, rgba(103, 55, 232, 0.55) 0%, rgba(103, 55, 232, 0) 72%);
          pointer-events: none;
        }
        .obsplash-title {
          position: relative;
          margin: 0;
          text-align: center;
          font-size: clamp(21px, 6.2vw, 30px);
          font-weight: 800;
          line-height: 1.35;
          letter-spacing: -0.01em;
          /* 기본값은 단색 — 그라데이션(background-clip:text)을 못 그리는 웹뷰에서도
             글자가 투명해지지 않게 한다. 지원하면 아래 @supports 가 덮어쓴다. */
          color: #ece2ff;
        }
        @supports ((-webkit-background-clip: text) or (background-clip: text)) {
          .obsplash-title {
            background: linear-gradient(104deg, #f3ecff 0%, #c9b4ff 26%, #8e6bff 52%, #c9b4ff 74%, #f3ecff 100%);
            background-size: 220% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            animation: obsplash-shine 5200ms ease-in-out 3000ms infinite;
          }
        }
        .obsplash-skip {
          position: absolute;
          right: 16px;
          top: calc(14px + env(safe-area-inset-top, 0px));
          padding: 7px 14px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          animation: obsplash-fade 900ms ease 2600ms both;
        }
        @keyframes obsplash-dim {
          from {
            background: rgba(5, 1, 15, 0);
          }
          to {
            background: rgba(5, 1, 15, 1);
          }
        }
        @keyframes obsplash-rise {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.14);
            filter: brightness(0.25) saturate(0.7);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
            filter: brightness(1) saturate(1);
          }
        }
        @keyframes obsplash-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes obsplash-title {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes obsplash-shine {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .obsplash,
          .obsplash-video,
          .obsplash-veil,
          .obsplash-copy,
          .obsplash-title,
          .obsplash-skip {
            animation-duration: 1ms;
            animation-delay: 0ms;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
