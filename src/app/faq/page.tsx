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
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-correct)", flexShrink: 0 }}>Q.</span>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text-c)" }}>{faq.title}</p>
      </div>
    ),
    content: (
      <div style={{ padding: "0 0 16px 30px", fontSize: 14, lineHeight: 1.6, color: "var(--c-text-2d)", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-warn)", flexShrink: 0 }}>A.</span>
        <span style={{ whiteSpace: "pre-wrap" }}>{faq.body}</span>
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "var(--c-bg)" }}>
      <BackHeader title="자주묻는 질문" />
      {items.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-4c)", fontSize: 14 }}>
          등록된 질문이 없습니다.
        </p>
      ) : (
        <Accordion items={items} />
      )}
    </div>
  );
}
