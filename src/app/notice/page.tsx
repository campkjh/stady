import BackHeader from "@/components/BackHeader";
import Accordion from "@/components/Accordion";
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
        <p style={{ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          {notice.isRecent && (
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#FF3B30", borderRadius: 6, padding: "2px 6px", lineHeight: 1.2 }}>
              최근
            </span>
          )}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{notice.title}</span>
        </p>
        {notice.dateLabel && (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>{notice.dateLabel}</p>
        )}
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px" }}>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#4B5563", whiteSpace: "pre-wrap" }}>
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
      </div>
    ),
    };
  });

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="공지사항" />
      {items.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <Accordion items={items} defaultOpenId={focus} />
      )}
    </div>
  );
}
