"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isNoticePopupActive } from "./NoticePopup";

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
  popupEnabled?: boolean;
  popupVersion?: number;
}

// 사용자가 × 로 "닫은" 공지 id. 이 id와 다른(=새) 공지면 카드 노출.
// (예전엔 열람만 해도 저장하던 seen 키를 썼기에, 의미가 바뀐 지금은 새 키를 사용해
//  과거 값이 남아 카드가 안 뜨던 문제를 없앤다.)
const SEEN_KEY = "home_notice_dismissed_id";

export default function NoticeHomeCard() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/notices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const first: Notice | undefined = d?.notices?.[0];
        if (!first) return;
        // 맨 위 공지가 진입 팝업으로 뜨는 중이면 같은 공지를 카드로 중복 노출하지 않는다.
        // (팝업을 "N일 안보기"로 닫은 뒤에는 팝업이 사라지므로 그때부터 카드로만 남는다.)
        if (isNoticePopupActive(first)) return;
        let seen = "";
        try {
          seen = localStorage.getItem(SEEN_KEY) || "";
        } catch {
          // localStorage 차단 환경에서는 매번 노출.
        }
        if (first.id !== seen) setNotice(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 카드를 열어 공지를 봐도 숨기지 않는다(다음에도 계속 노출). 해당 공지로 포커스.
  function open() {
    if (!notice) return;
    router.push(`/notice?focus=${encodeURIComponent(notice.id)}`);
  }
  // 오직 우측 × 를 눌렀을 때만 이 공지를 숨긴다(안 볼 사람용). 더 새 공지가 오면 다시 노출.
  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      if (notice) localStorage.setItem(SEEN_KEY, notice.id);
    } catch {
      // ignore
    }
    setNotice(null);
  }

  if (!notice) return null;
  const img = notice.imageUrls?.[0];

  return (
    <div style={{ padding: "2px 10px 10px" }}>
      {/* 홈 말풍선(새 문제집 말풍선)과 같은 유리 말풍선 — 꼬리만 없다. */}
      <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }} className="press nhc" aria-label={`공지: ${notice.title}`}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="nhc-thumb" />
        ) : (
          <span className="nhc-ic" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/mp-notice.svg" alt="" />
          </span>
        )}
        <div className="nhc-text">
          <p className="nhc-title">{notice.title}</p>
          <p className="nhc-sub">{notice.body.replace(/\s+/g, " ").trim()}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="닫기" className="nhc-x">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <style>{`
        .nhc {
          position: relative; display: flex; align-items: center; gap: 13px; padding: 14px 16px 14px 14px; border-radius: 26px; cursor: pointer;
          background: linear-gradient(180deg, rgba(250, 252, 255, 0.82) 0%, #FEFEFE 55%);
          -webkit-backdrop-filter: blur(12px) saturate(1.2); backdrop-filter: blur(12px) saturate(1.2);
          border: 1px solid rgba(40, 70, 130, 0.07);
          box-shadow: 0 14px 30px -12px rgba(22, 38, 72, 0.16), 0 4px 14px -6px rgba(22, 38, 72, 0.07);
          -webkit-tap-highlight-color: transparent; outline: none;
          animation: nhcIn 0.6s cubic-bezier(0.2, 1.25, 0.3, 1) backwards;
        }
        [data-theme="dark"] .nhc { background: #2A2A33; border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 14px 30px -12px rgba(0, 0, 0, 0.6); }
        .nhc-ic { width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(55, 135, 255, 0.1); animation: nhcPop 0.6s cubic-bezier(0.22, 1.7, 0.36, 1) 0.25s backwards; }
        .nhc-ic img { width: 24px; height: 24px; display: block; }
        .nhc-thumb { width: 44px; height: 44px; border-radius: 14px; object-fit: cover; flex-shrink: 0; display: block; animation: nhcPop 0.6s cubic-bezier(0.22, 1.7, 0.36, 1) 0.25s backwards; }
        .nhc-text { flex: 1; min-width: 0; animation: nhcFade 0.5s ease 0.2s backwards; }
        .nhc-title {
          margin: 0; width: fit-content; max-width: 100%; font-size: 16px; font-weight: 700; line-height: 1.4; letter-spacing: -0.3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: linear-gradient(90deg, #2F6FE0 0%, #254692 22%, #1C2943 42%, #191F28 55%, #191F28 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
        }
        [data-theme="dark"] .nhc-title { background: linear-gradient(90deg, #7FB0FF 0%, #9CC3FF 30%, #E7EAF0 50%, #E7EAF0 100%); -webkit-background-clip: text; background-clip: text; }
        .nhc-sub { margin: 3px 0 0; font-size: 14px; font-weight: 500; line-height: 1.4; letter-spacing: -0.2px; color: #6B7684; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        [data-theme="dark"] .nhc-sub { color: #A7ACB6; }
        .nhc-x { flex-shrink: 0; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #E0E3E9; color: #9398A3; cursor: pointer; position: relative; }
        .nhc-x::before { content: ""; position: absolute; top: -10px; right: -10px; bottom: -10px; left: -10px; }
        [data-theme="dark"] .nhc-x { background: #3A3B45; color: #A7ACB6; }
        @keyframes nhcIn { from { opacity: 0; transform: translateY(-10px) scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes nhcPop { from { opacity: 0; transform: scale(0.5) rotate(-18deg); } to { opacity: 1; transform: none; } }
        @keyframes nhcFade { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .nhc, .nhc-ic, .nhc-thumb, .nhc-text { animation: none; } }
      `}</style>
    </div>
  );
}
