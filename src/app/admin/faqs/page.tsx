"use client";

import SiteContentAdmin from "@/components/SiteContentAdmin";

export default function AdminFaqsPage() {
  return (
    <SiteContentAdmin
      kind="faq"
      heading="자주묻는질문 관리"
      titleLabel="질문"
      bodyLabel="답변"
      withDate={false}
    />
  );
}
