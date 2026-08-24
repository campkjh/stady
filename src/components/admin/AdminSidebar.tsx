"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavCategoriesIcon,
  NavCommentsIcon,
  NavDashboardIcon,
  NavPostsIcon,
  NavReportsIcon,
  NavTagsIcon,
  NavUsersIcon,
} from "./admin-icons";

export const communityAdminNavItems = [
  { href: "/admin", label: "대시보드", icon: NavDashboardIcon },
  { href: "/admin/community-posts", label: "게시글 관리", icon: NavPostsIcon },
  { href: "/admin/comments", label: "댓글 관리", icon: NavCommentsIcon },
  { href: "/admin/category-groups", label: "카테고리 관리", icon: NavCategoriesIcon },
  { href: "/admin/tags", label: "태그 관리", icon: NavTagsIcon },
  { href: "/admin/reports", label: "신고·차단 관리", icon: NavReportsIcon },
  { href: "/admin/users", label: "사용자 관리", icon: NavUsersIcon },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "grid", gap: 4 }}>
      {communityAdminNavItems.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              borderRadius: 8,
              color: active ? "#fff" : "var(--c-text-5d)",
              background: active ? "var(--c-brand)" : "transparent",
              padding: "10px 12px",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* 아이콘은 fill=currentColor 라 위 color 를 그대로 따라온다(활성=흰색). */}
            <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
