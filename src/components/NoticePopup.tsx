"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
//
// ⚠️ 안드로이드 웹뷰에서 "딤만 뜨고 카드가 안 보이는" 신고가 있었다. 원인 후보를 모두
// 걷어낸 형태로 둔다 — 이 파일에서 아래 4가지는 되돌리지 말 것:
//   1) document.body 포털: 조상에 transform/filter/overflow:clip 이 있으면 position:fixed 가
//      뷰포트가 아니라 그 조상에 갇히거나 잘린다(홈 트리 안에 있으면 실제로 그럴 수 있다).
//   2) 등장 애니메이션 없음: animation-fill-mode 로 시작 상태(opacity:0)에 멈추는 사고가 있었다.
//   3) inset 단축 대신 top/right/bottom/left: 구형 웹뷰는 inset 을 모른다.
//   4) 카드에 overflow:hidden + border-radius + box-shadow 조합을 쓰지 않음:
//      구형 안드로이드 웹뷰에서 이 조합이 통째로 안 그려지는 사례가 있다.
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

// 홈의 "새 공지 카드"가 '진입 팝업으로도 뜨는 공지'를 카드로 중복 노출하지 않도록 공유한다.
export function isNoticePopupActive(n: { id: string; popupEnabled?: boolean; popupVersion?: number }): boolean {
  return n.popupEnabled === true && !isDismissed(n as Notice);
}

export default function NoticePopup() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  // 포털은 마운트 후에만(서버 렌더 시 document 가 없다).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    // 팝업 노출/버전이 stale하면 안 되므로 항상 최신을 받는다.
    fetch("/api/notices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const list: Notice[] = Array.isArray(d?.notices) ? d.notices : [];
        // 진입 팝업은 '맨 위(정렬 최상단) 공지'가 팝업 대상일 때만 띄운다.
        // 예전엔 맨 위 공지를 숨기면 아래로 내려가 오래된 팝업 공지까지 다시 꺼내왔고,
        // 그 탓에 홈 카드(최신 공지) + 팝업(오래된 공지)이 동시에 떠 "2개가 뜨는" 중복이 생겼다.
        const top = list[0];
        if (top && top.popupEnabled === true && !isDismissed(top)) setNotice(top);
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

  if (!mounted || !notice) return null;
  const img = notice.imageUrls?.[0];

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 2000,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
      onClick={closeSession}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          maxHeight: "86%",
          background: "var(--c-bg)",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(15,23,42,0.06)",
          boxSizing: "border-box",
        }}
      >
        {/* 내용(탭하면 공지 전체 보기) */}
        <div style={{ overflowY: "auto", cursor: "pointer", minHeight: 0 }} onClick={openFull}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover", borderRadius: "20px 20px 0 0" }}
            />
          )}
          <div style={{ padding: "18px 20px 16px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--c-brand)", background: "var(--c-brand-soft-9)", borderRadius: 6, padding: "2px 7px" }}>공지</span>
            <h2 style={{ margin: "10px 0 8px", fontSize: 18, fontWeight: 800, color: "var(--c-text-b)", lineHeight: 1.35 }}>{notice.title}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--c-text-2d)", whiteSpace: "pre-wrap" }}>{notice.body}</p>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--c-brand)", fontWeight: 700 }}>공지사항에서 자세히 보기 ›</p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "flex", borderTop: "1px solid var(--c-bg-muted-9)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={hideForDays}
            style={{ flex: 1, height: 52, border: "none", background: "var(--c-bg-soft)", color: "var(--c-text-3)", fontSize: 14.5, fontWeight: 800, cursor: "pointer", borderRadius: "0 0 0 20px" }}
          >
            {hideDays}일 동안 안보기
          </button>
          <button
            type="button"
            onClick={closeSession}
            style={{ flex: 1, height: 52, border: "none", background: "var(--c-bg)", color: "var(--c-text)", fontSize: 14.5, fontWeight: 900, cursor: "pointer", borderRadius: "0 0 20px 0" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
