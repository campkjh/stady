import BackHeader from "@/components/BackHeader";
import Accordion from "@/components/Accordion";
import { listSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export default async function FAQPage() {
  const faqs = await listSiteContent("faq", true);
  const items = faqs.map((faq) => ({
    id: faq.id,
    header: (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#4A90D9", flexShrink: 0 }}>Q.</span>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{faq.title}</p>
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px 30px", fontSize: 14, lineHeight: 1.6, color: "#4B5563", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B", flexShrink: 0 }}>A.</span>
        <span style={{ whiteSpace: "pre-wrap" }}>{faq.body}</span>
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="자주묻는 질문" />
      {items.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
          등록된 질문이 없습니다.
        </p>
      ) : (
        <Accordion items={items} />
      )}
    </div>
  );
}
