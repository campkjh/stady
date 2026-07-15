"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
  popupEnabled?: boolean;
  popupHideDays?: number;
  popupVersion?: number;
}

// 진입 팝업: 어드민이 "팝업으로 노출"을 켠 공지 중, 아직 안 숨긴 정렬 맨 위 공지를 보여준다.
// "N일 동안 안보기"(N=어드민 설정)로 닫으면 그 공지는 N일간 안 뜨고,
// "닫기"는 이번 세션만 닫는다(다음 진입 때 다시 노출). 켜진 공지가 없으면 아무것도 안 뜬다.
//
// 숨김 키에 팝업 버전(popupVersion)을 포함한다. 어드민이 팝업을 다시 켜거나 내용/기간을
// 바꾸면 버전이 올라가 키가 달라지므로, 이미 "N일 안보기"를 눌렀던 사용자에게도 다시 뜬다.
const DAY_MS = 24 * 60 * 60 * 1000;
const ver = (n: Notice) => n.popupVersion ?? 0;
const hideKey = (n: Notice) => `notice_popup_hidden_until_${n.id}_${ver(n)}`;
const sessKey = (n: Notice) => `notice_popup_closed_${n.id}_${ver(n)}`;

function isDismissed(n: Notice): boolean {
  try {
    const until = Number(localStorage.getItem(hideKey(n)));
    if (Number.isFinite(until) && until > Date.now()) return true;
  } catch {
    /* localStorage 차단 시 노출 */
  }
  try {
    if (sessionStorage.getItem(sessKey(n)) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export default function NoticePopup() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    // 팝업 노출/버전이 stale하면 안 되므로 항상 최신을 받는다.
    fetch("/api/notices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const list: Notice[] = Array.isArray(d?.notices) ? d.notices : [];
        // 팝업 켜진 공지(정렬순) 중 아직 안 숨긴 첫 번째를 노출(맨 위가 숨겨졌으면 다음으로).
        const pick = list.filter((n) => n.popupEnabled === true).find((n) => !isDismissed(n));
        if (pick) setNotice(pick);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const hideDays = notice?.popupHideDays && notice.popupHideDays > 0 ? Math.round(notice.popupHideDays) : 7;

  function closeSession() {
    try {
      if (notice) sessionStorage.setItem(sessKey(notice), "1");
    } catch {
      /* ignore */
    }
    setNotice(null);
  }
  function hideForDays() {
    try {
      if (notice) localStorage.setItem(hideKey(notice), String(Date.now() + hideDays * DAY_MS));
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
          <button type="button" onClick={hideForDays} style={{ height: 52, border: "none", background: "#F9FAFB", color: "#6B7280", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
            {hideDays}일 동안 안보기
          </button>
          <button type="button" onClick={closeSession} style={{ height: 52, border: "none", background: "#fff", color: "#111827", fontSize: 14.5, fontWeight: 900, cursor: "pointer" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
