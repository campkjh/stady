import BackHeader from "@/components/BackHeader";
import Accordion from "@/components/Accordion";
import NoticeReactions from "@/components/NoticeReactions";
import { listSiteContent } from "@/lib/siteContent";

// 공지는 관리자가 수시로 바꾸므로 항상 최신을 보여준다.
export const dynamic = "force-dynamic";

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const notices = await listSiteContent("notice", true);
  const items = notices.map((notice) => {
    return {
    id: notice.id,
    header: (
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          {notice.isRecent && (
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#fff", background: "var(--c-danger-e)", borderRadius: 6, padding: "2px 6px", lineHeight: 1.2 }}>
              최근
            </span>
          )}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{notice.title}</span>
        </p>
        {notice.dateLabel && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-5)" }}>{notice.dateLabel}</p>
        )}
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px" }}>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--c-text-3)", whiteSpace: "pre-wrap" }}>
          {notice.body}
        </div>
        {notice.imageUrls.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {notice.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />
            ))}
          </div>
        )}
        {/* 공감/댓글 — 커뮤니티에 미러링된 글에 달린다. */}
        {notice.postId && <NoticeReactions postId={notice.postId} />}
      </div>
    ),
    };
  });

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "var(--c-bg)" }}>
      <BackHeader title="공지사항" />
      {items.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <div style={{ padding: "8px 20px 40px" }}>
          <div style={{ borderRadius: 18, border: "1px solid var(--c-border)", background: "var(--c-bg)", overflow: "hidden" }}>
            {/* Accordion 내장 패딩(0 20px)을 카드 안 18px로 보정하고, 마지막 행의 1px 구분선은 카드 밖으로 밀어 clip */}
            <div style={{ margin: "0 -2px -1px" }}>
              <Accordion items={items} defaultOpenId={focus} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
