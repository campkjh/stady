"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
}

// 마지막으로 확인한 공지 id. 이 id와 다른(=새) 공지가 있으면 카드 노출.
const SEEN_KEY = "home_notice_seen_id";

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

  // 카드를 열어 공지를 봐도 숨기지 않는다(다음에도 계속 노출).
  function open() {
    router.push("/notice");
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
    <div style={{ padding: "0 10px 8px" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 14,
          background: "#F6F8FB",
          border: "1px solid #EEF1F5",
          cursor: "pointer",
        }}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0, display: "block" }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#3787FF", background: "#E9F1FF", borderRadius: 5, padding: "1px 5px", flexShrink: 0 }}>공지</span>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#191F28", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {notice.title}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#8A909C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notice.body}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, border: "none", background: "none", color: "#B0B8C1", fontSize: 18, lineHeight: 1, cursor: "pointer" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
