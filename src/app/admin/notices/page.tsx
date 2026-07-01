"use client";

import SiteContentAdmin from "@/components/SiteContentAdmin";

export default function AdminNoticesPage() {
  return (
    <SiteContentAdmin
      kind="notice"
      heading="공지사항 관리"
      titleLabel="제목"
      bodyLabel="내용"
      withDate
      withImages
    />
  );
}
