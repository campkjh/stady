"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
}

// 진입 팝업: 맨 위(첫 번째) 공지를 보여준다. "7일동안 안보기"로 닫으면 그 공지는
// 7일간 안 뜨고, "닫기"는 이번 세션만 닫는다(다음 진입 때 다시 노출).
const hideKey = (id: string) => `notice_popup_hidden_until_${id}`;
const SESSION_KEY = "notice_popup_closed_session";

export default function NoticePopup() {
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
        try {
          const until = Number(localStorage.getItem(hideKey(first.id)));
          if (Number.isFinite(until) && until > Date.now()) return;
        } catch {
          /* localStorage 차단 시 노출 */
        }
        try {
          if (sessionStorage.getItem(SESSION_KEY) === first.id) return;
        } catch {
          /* ignore */
        }
        setNotice(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function closeSession() {
    try {
      if (notice) sessionStorage.setItem(SESSION_KEY, notice.id);
    } catch {
      /* ignore */
    }
    setNotice(null);
  }
  function hide7Days() {
    try {
      if (notice) localStorage.setItem(hideKey(notice.id), String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
    setNotice(null);
  }
  function openFull() {
    if (!notice) return;
    closeSession();
    router.push(`/notice?focus=${encodeURIComponent(notice.id)}`);
  }

  if (!notice) return null;
  const img = notice.imageUrls?.[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={closeSession}
    >
      <div
        className="fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          maxHeight: "86vh",
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* 내용(탭하면 공지 전체 보기) */}
        <div style={{ overflowY: "auto", cursor: "pointer" }} onClick={openFull}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" style={{ width: "100%", display: "block", maxHeight: "52vh", objectFit: "cover" }} />
          )}
          <div style={{ padding: "18px 20px 16px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#3787FF", background: "#E9F1FF", borderRadius: 6, padding: "2px 7px" }}>공지</span>
            <h2 style={{ margin: "10px 0 8px", fontSize: 18, fontWeight: 800, color: "#191F28", lineHeight: 1.35 }}>{notice.title}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#4B5563", whiteSpace: "pre-wrap" }}>{notice.body}</p>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#3787FF", fontWeight: 700 }}>공지사항에서 자세히 보기 ›</p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #EEF2F7", flexShrink: 0 }}>
          <button type="button" onClick={hide7Days} style={{ height: 52, border: "none", background: "#F9FAFB", color: "#6B7280", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
            7일동안 안보기
          </button>
          <button type="button" onClick={closeSession} style={{ height: 52, border: "none", background: "#fff", color: "#111827", fontSize: 14.5, fontWeight: 900, cursor: "pointer" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
