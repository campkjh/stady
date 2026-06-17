"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const communityAdminNavItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/community-posts", label: "게시글 관리" },
  { href: "/admin/comments", label: "댓글 관리" },
  { href: "/admin/category-groups", label: "카테고리 관리" },
  { href: "/admin/tags", label: "태그 관리" },
  { href: "/admin/reports", label: "신고 관리" },
  { href: "/admin/users", label: "사용자 관리" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "grid", gap: 4 }}>
      {communityAdminNavItems.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              borderRadius: 8,
              color: active ? "#fff" : "#D1D5DB",
              background: active ? "#3787FF" : "transparent",
              padding: "10px 12px",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
