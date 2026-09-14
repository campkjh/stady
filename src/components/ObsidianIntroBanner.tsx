"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 옵시디언 화면 첫 진입 배너 — 딤 위에 이미지 한 장, 우상단 X.
// X 를 누르면 3일 동안 다시 안 뜬다(닫기 시각을 저장해 만료로 판단).
// 배경을 누르면 이번만 닫힌다.
//
// WebView 규칙: document.body 포털 / inset 단축 금지 / 등장 애니메이션 없음(NoticePopup 과 동일).
const KEY = "obsidian_intro_hidden_until";
const HIDE_DAYS = 3;

export default function ObsidianIntroBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 첫 페인트 뒤에 판단한다(localStorage 를 렌더 중에 읽으면 서버 HTML 과 어긋난다).
    let until = 0;
    try {
      until = Number(localStorage.getItem(KEY) || 0);
    } catch {
      until = 0;
    }
    if (until > Date.now()) return;
    // 이펙트 본문에서 바로 setState 하지 않는다(React Compiler 가 막는다) — 콜백으로 넘긴다.
    const t = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(t);
  }, []);

  function closeForDays() {
    try {
      localStorage.setItem(KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      /* 저장 못 해도 닫기는 된다 */
    }
    setOpen(false);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2500,
        background: "rgba(15,23,42,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 340 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banners/obsidian-rank.jpg"
          alt="옵시디언 랭킹 3위 이내 달성 시 스타디 프라임 일주일 무료"
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 32 }}
        />
        <button
          type="button"
          onClick={closeForDays}
          aria-label="닫기 (3일 동안 안 보기)"
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
