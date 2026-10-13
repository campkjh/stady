"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useModalExit } from "@/lib/useModalExit";
import NoticeBody from "@/components/NoticeBody";

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
const DIM_HIDE_DAYS = 3; // 딤으로 닫았을 때 쉬는 기간
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
// 팝업 = 노출 중인 공지 중 맨 위(최신) 1개. 즉 목록의 맨 위 공지가 아직 안 숨겨졌으면 그게 팝업이다.
export function isNoticePopupActive(n: { id: string; popupVersion?: number }): boolean {
  return !isDismissed(n as Notice);
}

export default function NoticePopup() {
  const router = useRouter();
  const { leaving, exit } = useModalExit();
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
        // 진입 팝업 = 노출 중인 공지 중 '맨 위(=최신) 1개'. 대표가 새 공지를 올리면 그게 맨 위가 되어
        // 곧 새 팝업이 된다. 예전처럼 아래(오래된) 공지로 내려가지 않는다(팝업은 항상 하나).
        const top = list[0];
        if (top && !isDismissed(top)) setNotice(top);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const hideDays = notice?.popupHideDays && notice.popupHideDays > 0 ? Math.round(notice.popupHideDays) : 7;

  // 딤(배경)으로 닫아도 며칠은 다시 안 뜬다 — 예전엔 세션에만 표시해서 앱을 다시 켤 때마다
  // 같은 팝업이 계속 떴다. 명시적으로 "N일 동안 안보기" 를 누르면 설정값(hideDays)만큼,
  // 딤으로 닫으면 DIM_HIDE_DAYS 만큼 쉬어 간다.
  function closeSession() {
    try {
      if (notice) {
        sessionStorage.setItem(sessKey(notice), "1");
        const days = Math.min(DIM_HIDE_DAYS, hideDays);
        localStorage.setItem(hideKey(notice), String(Date.now() + days * DAY_MS));
      }
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

  useBodyScrollLock(!!notice);
  if (!mounted || !notice) return null;
  const img = notice.imageUrls?.[0];

  const overlay = (
    <div
      data-gate="notice"
      className={`mdl-root${leaving ? " is-leaving" : ""}`}
      style={{ zIndex: 2000, padding: 20 }}
    >
      <div className="mdl-dim" onClick={() => exit(closeSession)} />
      <div className="mdl-card is-wide">
        {/* 내용(탭하면 공지 전체 보기) */}
        <div className="mdl-scroll" style={{ cursor: "pointer" }} onClick={() => exit(openFull)}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover", borderRadius: "24px 24px 0 0" }}
            />
          )}
          <div className="mdl-text">
            <span className="mdl-tag">공지</span>
            <h2 className="mdl-title" style={{ marginTop: 10 }}>{notice.title}</h2>
            <NoticeBody body={notice.body} className="mdl-body is-sm" />
            <p className="mdl-cap" style={{ color: "var(--mdl-accent)", fontWeight: 600 }}>공지사항에서 자세히 보기 ›</p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="mdl-actions is-tight" style={{ flexShrink: 0 }}>
          <button type="button" className="mdl-btn is-sub" onClick={() => exit(hideForDays)}>
            {hideDays}일 동안 안보기
          </button>
          <button type="button" className="mdl-btn is-main" onClick={() => exit(closeSession)}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
