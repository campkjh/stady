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
// 저장소가 초기화되는 웹뷰(앱을 껐다 켜면 localStorage 가 비는 경우)를 대비해 쿠키로도 남긴다.
// 둘 중 하나라도 남아 있으면 다시 띄우지 않는다 — 스플래시가 매번 떠서 검은 화면처럼 보이던 신고 대응.
const SEEN_COOKIE = "stady_obs_intro_v2";
// 마스터 계정은 연출을 계속 확인해야 해서 1회 제한 없이 매번 본다.
const OWNER_EMAIL = "campkjh@nate.com";
const OWNER_FLAG_KEY = "obsidian_splash_owner"; // "1|<확인시각>" — 12시간 캐시
const HOLD_MS = 9000; // 영상이 아예 재생 안 될 때를 위한 안전망
const OUTRO_MS = 1800; // 영상이 끝난 뒤 글자만 남기는 마무리
const FADE_MS = 700;

// 로그인한 계정이 마스터인지 — 본 적 있는 사람에게만 확인하고, 답은 12시간 캐시해서
// 일반 사용자가 타이머에 들어올 때마다 /api/auth/me 를 두드리지 않게 한다.
async function isOwnerAccount(): Promise<boolean> {
  const OWNER_TTL_MS = 12 * 60 * 60 * 1000;
  try {
    const raw = localStorage.getItem(OWNER_FLAG_KEY);
    if (raw) {
      const [flag, at] = raw.split("|");
      if (Date.now() - Number(at) < OWNER_TTL_MS) return flag === "1";
    }
  } catch {
    /* 저장소를 못 읽으면 그냥 물어본다 */
  }
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = res.ok ? await res.json() : null;
    const owner = data?.user?.email === OWNER_EMAIL;
    try {
      localStorage.setItem(OWNER_FLAG_KEY, `${owner ? 1 : 0}|${Date.now()}`);
    } catch {
      /* 캐시 못 해도 동작엔 지장 없다 */
    }
    return owner;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* 무시 */
  }
  try {
    document.cookie = `${SEEN_COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  } catch {
    /* 무시 */
  }
}

function hasSeen(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return true;
  } catch {
    // 저장소를 아예 못 읽는 환경이면 쿠키만 본다(못 읽으면 아래에서 false).
  }
  try {
    return document.cookie.includes(`${SEEN_COOKIE}=1`);
  } catch {
    return false;
  }
}

// 재생을 못 하는 기기(자동재생 차단·코덱·네트워크)에서 새까만 화면이 오래 떠 있지 않도록,
// 이 시간 안에 실제로 프레임이 흐르지 않으면 바로 마무리 장면(글자)으로 넘어간다.
const PLAY_WATCHDOG_MS = 4000;

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
  const [revealed, setRevealed] = useState(false);
  // 영상이 끝나면(또는 iOS 전체화면 재생이 끝나면) 영상을 걷고 글자만 남긴다.
  const [outro, setOutro] = useState(false);
  const outroRef = useRef(false);
  const playedRef = useRef(false); // 영상이 실제로 흐르기 시작했는지
  const closedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // mp4 를 못 트는 웹뷰면 아예 띄우지 않는다(검은 화면만 보이는 사고 방지).
    try {
      if (!document.createElement("video").canPlayType("video/mp4")) return;
    } catch {
      return;
    }
    const seen = hasSeen();
    // 공지 팝업 같은 다른 게이트가 떠 있으면 양보한다(첫 진입 배너는 스플래시 뒤에 서니 제외).
    const blocked = () => !!document.querySelector('[data-gate]:not([data-gate="intro-banner"])');
    if (!seen) {
      if (blocked()) return;
      // 닫을 때가 아니라 '열 때' 기록한다 — 중간에 앱이 죽거나 저장이 늦어도 다시 뜨지 않는다.
      const t = setTimeout(() => {
        markSeen();
        setOpen(true);
      }, 0);
      return () => clearTimeout(t);
    }
    // 이미 본 기기 — 마스터 계정이면 매번 다시 보여준다.
    let alive = true;
    isOwnerAccount().then((owner) => {
      if (alive && owner && !blocked()) setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    markSeen();
    // 영상이 네이티브 전체화면으로 승격됐으면 반드시 빠져나온다. 안 그러면 웹뷰가 검은
    // 비디오 화면을 그대로 띄워둔 채 남는다(갤럭시에서 '계속 검은 화면' 신고).
    const v = videoRef.current as (HTMLVideoElement & {
      webkitExitFullscreen?: () => void;
    }) | null;
    try {
      v?.webkitExitFullscreen?.();
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch {
      /* 무시 */
    }
    try {
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load(); // 디코더·표면 해제
      }
    } catch {
      /* 무시 */
    }
    setClosing(true);
    setTimeout(() => setOpen(false), FADE_MS);
  }, []);

  // iOS 는 인라인 재생이 막혀 있으면 영상을 네이티브 전체화면 플레이어로 띄우는데,
  // 그 화면은 HTML 위에 그려져서 타이틀·건너뛰기가 가려진다. 그래서 재생이 끝나면
  // 영상을 걷고 글자만 남는 마무리 장면을 한 번 더 보여준다.
  const endVideo = useCallback(() => {
    if (outroRef.current || closedRef.current) return;
    outroRef.current = true;
    setOutro(true);
    setTimeout(close, OUTRO_MS);
  }, [close]);

  useEffect(() => {
    if (!open || outro) return;
    const t = setTimeout(close, HOLD_MS);
    return () => clearTimeout(t);
  }, [open, outro, close]);

  useEffect(() => {
    if (!open) return;
    playWithSound(videoRef.current);
  }, [open]);

  // 자동재생이 막히거나 영상을 못 받는 기기에서 까만 화면이 오래 남지 않게 한다.
  // 한 번이라도 실제로 재생이 시작되면(onPlaying/onTimeUpdate) 감시를 끈다.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (!playedRef.current) endVideo(); // 프레임이 안 흘렀다 → 글자 장면으로
    }, PLAY_WATCHDOG_MS);
    return () => clearTimeout(t);
  }, [open, endVideo]);

  // iOS 네이티브 전체화면에서 빠져나온 순간도 '영상 끝'으로 본다(React 프롭엔 없는 이벤트).
  useEffect(() => {
    if (!open) return;
    const v = videoRef.current;
    if (!v) return;
    const onEndFs = () => endVideo();
    v.addEventListener("webkitendfullscreen", onEndFs);
    return () => v.removeEventListener("webkitendfullscreen", onEndFs);
  }, [open, endVideo]);

  // 애니메이션이 안 도는 웹뷰에서도 글자·건너뛰기가 반드시 보이게 하는 안전장치.
  // (CSS 애니메이션이 정상이면 애니메이션 값이 이겨서 연출 그대로 나온다)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setRevealed(true), 700);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`obsplash${closing ? " is-closing" : ""}${outro ? " is-outro" : ""}`}
      data-gate="obsidian-splash"
      onClick={close}
      role="presentation"
    >
      {/* 영상이 뜨기 전(로딩·자동재생 차단)에도 첫 프레임 이미지가 즉시 깔린다 —
          까만 화면만 보이던 시간을 없앤다. 8KB 라 바로 뜬다. */}
      <div className="obsplash-poster" aria-hidden="true" style={revealed ? { opacity: 1 } : undefined} />
      <video
        ref={videoRef}
        className="obsplash-video"
        // 애니메이션이 안 도는 웹뷰 보정 — 정상일 땐 애니메이션 값이 이겨서 연출 그대로다.
        style={revealed ? { opacity: 1 } : undefined}
        src="/intro/obsidian-intro.mp4"
        poster="/intro/obsidian-intro-poster.jpg"
        playsInline
        // 구형 iOS 웹뷰용 레거시 속성 — 이게 있어야 인라인 재생을 시도한다.
        // (네이티브가 allowsInlineMediaPlayback 을 꺼두면 그래도 전체화면으로 뜬다)
        {...{ "webkit-playsinline": "true", "x5-playsinline": "true" }}
        disablePictureInPicture
        controls={false}
        autoPlay
        preload="auto"
        onEnded={endVideo}
        onError={endVideo}
        onPlaying={() => { playedRef.current = true; }}
        onTimeUpdate={(e) => { if (e.currentTarget.currentTime > 0.1) playedRef.current = true; }}
        // 마운트 직후의 play() 는 아직 로드 전이라 거절될 수 있다 — 재생 가능해지면 한 번 더.
        onCanPlay={(e) => {
          if (e.currentTarget.paused) playWithSound(e.currentTarget);
        }}
      />
      <div className="obsplash-veil" />
      <div className="obsplash-copy" style={revealed ? { opacity: 1 } : undefined}>
        <span className="obsplash-glow" aria-hidden="true" />
        <p className="obsplash-title">시간을 기록하는 옵시디언</p>
      </div>
      <button
        type="button"
        className="obsplash-skip"
        onClick={close}
        style={revealed ? { opacity: 1 } : undefined}
      >
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
        /* 영상이 끝난 뒤(또는 iOS 전체화면 재생이 끝난 뒤) — 영상은 걷히고 글자만 남는다 */
        .obsplash.is-outro .obsplash-video {
          /* 애니메이션(fill: both)이 계속 opacity 를 잡고 있어서 먼저 떼어낸다 */
          animation: none;
          opacity: 0;
          transition: opacity 700ms ease;
        }
        .obsplash.is-outro .obsplash-veil {
          animation: none;
          opacity: 1;
          background-color: rgba(5, 1, 15, 0.92);
          transition: background-color 700ms ease;
        }
        .obsplash.is-outro .obsplash-copy {
          bottom: 50%;
          transform: translateZ(0) translateY(50%) scale(1.06);
          transition: bottom 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1);
          animation: none;
          opacity: 1;
        }
        .obsplash-poster {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 0;
          background: url("/intro/obsidian-intro-poster.jpg") center / cover no-repeat;
          animation: obsplash-fade 900ms ease 400ms both;
          pointer-events: none;
        }
        .obsplash.is-outro .obsplash-poster {
          opacity: 0;
          animation: none;
          transition: opacity 700ms ease;
        }
        .obsplash-video {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          transform: translate(-50%, -50%);
          object-fit: cover;
          z-index: 0;
          animation: obsplash-rise 2400ms cubic-bezier(0.16, 1, 0.3, 1) 700ms both;
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
          z-index: 1;
          animation: obsplash-fade 1600ms ease 700ms both;
          pointer-events: none;
        }
        .obsplash-copy {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: calc(96px + env(safe-area-inset-bottom, 0px));
          z-index: 2;
          /* 영상이 별도 레이어로 합성되는 웹뷰에서 글자가 뒤로 숨지 않게 층을 띄운다 */
          transform: translateZ(0);
          animation: obsplash-title 1200ms cubic-bezier(0.16, 1, 0.3, 1) 600ms both;
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
          z-index: 3;
          transform: translateZ(0);
          padding: 9px 16px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          animation: obsplash-fade 700ms ease 800ms both;
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
            transform: translateZ(0) translateY(18px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateZ(0) translateY(0) scale(1);
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
          .obsplash-poster,
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
