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
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-brand)", flexShrink: 0 }}>Q.</span>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{faq.title}</p>
      </div>
    ),
    content: (
      <div style={{ margin: "0 0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "14px 16px", borderRadius: 12, background: "var(--c-bg-soft)", fontSize: 14, lineHeight: 1.7, color: "var(--c-text-3)" }}>
          <span style={{ fontWeight: 700, color: "var(--c-warn)", flexShrink: 0 }}>A.</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{faq.body}</span>
        </div>
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "var(--c-bg)" }}>
      <BackHeader title="자주묻는 질문" />
      {items.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>
          등록된 질문이 없습니다.
        </p>
      ) : (
        <div style={{ padding: "8px 20px 40px" }}>
          <div style={{ borderRadius: 18, border: "1px solid var(--c-border)", background: "var(--c-bg)", overflow: "hidden" }}>
            {/* Accordion 내장 패딩(0 20px)을 카드 안 18px로 보정하고, 마지막 행의 1px 구분선은 카드 밖으로 밀어 clip */}
            <div style={{ margin: "0 -2px -1px" }}>
              <Accordion items={items} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
