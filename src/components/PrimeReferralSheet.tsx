"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

// 커뮤니티 진입 시 하단에서 올라오는 친구초대 시트.
// "일주일 동안 안보기"를 누르면 7일간 뜨지 않는다. 닫기는 이번 세션만.
//
// NoticePopup 과 같은 WebView 안전 규칙을 따른다:
//   document.body 포털 / inset 단축 대신 top·right·bottom·left / 시작 상태에 갇히는 애니메이션 금지.
const HIDE_KEY = "prime_referral_sheet_hidden_until";
const SESSION_KEY = "prime_referral_sheet_closed";
const DAY_MS = 24 * 60 * 60 * 1000;

export default function PrimeReferralSheet() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    let hidden = false;
    try {
      const until = Number(localStorage.getItem(HIDE_KEY));
      if (Number.isFinite(until) && until > Date.now()) hidden = true;
    } catch {
      /* 저장소가 막힌 환경에서는 그냥 노출 */
    }
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") hidden = true;
    } catch {
      /* ignore */
    }
    if (hidden) return;
    // 진입 직후 화면이 자리를 잡은 뒤 올라오게 한다.
    const t = setTimeout(() => setOpen(true), 450);
    return () => clearTimeout(t);
  }, []);

  function closeSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }
  function hideForWeek() {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + 7 * DAY_MS));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }
  function goInvite() {
    closeSession();
    router.push("/referral-event");
  }

  if (!mounted || !open) return null;

  const sheet = (
    <div className="prs-dim" onClick={closeSession}>
      <div className="prs" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="친구 초대하면 프라임 2주 무료">
        <button type="button" className="prs-banner" onClick={goInvite}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="prs-img" src="/banners/prime-referral-banner.webp" alt="친구 초대하면 프라임 2주 무료" />
          <span className="prs-glass">
            친구 초대하기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginLeft: 1 }}>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div className="prs-foot">
          <button type="button" className="prs-btn prs-week" onClick={hideForWeek}>일주일 동안 안보기</button>
          <button type="button" className="prs-btn prs-close" onClick={closeSession}>닫기</button>
        </div>
      </div>

      <style>{`
        .prs-dim {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 2400;
          background: rgba(15,23,42,0.5);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .prs {
          width: 100%; max-width: 520px;
          background: var(--c-bg);
          border-radius: 20px 20px 0 0;
          padding: 14px 14px calc(10px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          animation: prs-up 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes prs-up { from { transform: translateY(14px); } to { transform: translateY(0); } }
        .prs-banner {
          position: relative; display: block; width: 100%; border: none; padding: 0; margin: 0;
          background: none; cursor: pointer; border-radius: 16px; overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .prs-img { display: block; width: 100%; height: auto; border-radius: 16px; }
        .prs-glass {
          position: absolute; right: 14px; bottom: 14px;
          display: inline-flex; align-items: center; gap: 5px;
          padding: 9px 16px; border-radius: 999px;
          font-size: 13.5px; font-weight: 800; letter-spacing: -0.2px; color: #2f3ba3;
          background: rgba(255,255,255,0.34);
          -webkit-backdrop-filter: blur(9px) saturate(1.35);
          backdrop-filter: blur(9px) saturate(1.35);
          border: 1px solid rgba(255,255,255,0.62);
          box-shadow: 0 5px 16px rgba(80,90,180,0.2), inset 0 1px 0 rgba(255,255,255,0.72);
          pointer-events: none;
        }
        .prs-foot { display: flex; gap: 8px; margin-top: 12px; }
        .prs-btn {
          flex: 1; height: 48px; border: none; border-radius: 14px;
          font-size: 14.5px; font-weight: 800; cursor: pointer;
        }
        .prs-week { background: var(--c-bg-soft); color: var(--c-text-3); }
        .prs-close { background: var(--c-brand); color: #fff; }
        @media (max-width: 420px) {
          .prs-glass { right: 11px; bottom: 11px; padding: 8px 13px; font-size: 12.5px; }
        }
      `}</style>
    </div>
  );

  return createPortal(sheet, document.body);
}
