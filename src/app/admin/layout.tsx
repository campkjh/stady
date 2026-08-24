"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  NavBannersIcon,
  MenuIcon,
  NavCategoriesIcon,
  NavCommentsIcon,
  NavDashboardIcon,
  NavInsightsIcon,
  NavFaqsIcon,
  NavInquiriesIcon,
  NavMockexamsIcon,
  NavNoticesIcon,
  NavOxIcon,
  NavPostsIcon,
  NavReportsIcon,
  NavSurveysIcon,
  NavTagsIcon,
  NavUsersIcon,
  NavVocabIcon,
  NavWorkbooksIcon,
} from "@/components/admin/admin-icons";

interface User {
  id: string;
  email: string;
  nickname: string;
  role: string;
}

const navItems = [
  {
    href: "/admin",
    label: "대시보드",
    icon: <NavDashboardIcon size={20} />,
  },
  {
    href: "/admin/insights",
    label: "사용자 인사이트",
    icon: <NavInsightsIcon size={20} />,
  },
  {
    href: "/admin/community-posts",
    label: "게시글 관리",
    icon: <NavPostsIcon size={20} />,
  },
  {
    href: "/admin/comments",
    label: "댓글 관리",
    icon: <NavCommentsIcon size={20} />,
  },
  {
    href: "/admin/category-groups",
    label: "카테고리 관리",
    icon: <NavCategoriesIcon size={20} />,
  },
  {
    href: "/admin/tags",
    label: "태그 관리",
    icon: <NavTagsIcon size={20} />,
  },
  {
    href: "/admin/reports",
    label: "신고·차단 관리",
    icon: <NavReportsIcon size={20} />,
  },
  {
    href: "/admin/workbooks",
    label: "문제집 관리",
    icon: <NavWorkbooksIcon size={20} />,
  },
  {
    href: "/admin/users",
    label: "사용자 관리",
    icon: <NavUsersIcon size={20} />,
  },
  {
    href: "/admin/ox-quiz",
    label: "OX퀴즈 관리",
    icon: <NavOxIcon size={20} />,
  },
  {
    href: "/admin/vocab-quiz",
    label: "영단어퀴즈 관리",
    icon: <NavVocabIcon size={20} />,
  },
  {
    href: "/admin/banners",
    label: "배너 관리",
    icon: <NavBannersIcon size={20} />,
  },
  {
    href: "/admin/inquiries",
    label: "문의 관리",
    icon: <NavInquiriesIcon size={20} />,
  },
  {
    href: "/admin/surveys",
    label: "설문 결과",
    icon: <NavSurveysIcon size={20} />,
  },
  {
    href: "/admin/notices",
    label: "공지사항 관리",
    icon: <NavNoticesIcon size={20} />,
  },
  {
    href: "/admin/faqs",
    label: "FAQ 관리",
    icon: <NavFaqsIcon size={20} />,
  },
  {
    href: "/admin/mock-exams",
    label: "모의고사 관리",
    icon: <NavMockexamsIcon size={20} />,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <style>{`body { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }`}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg-soft)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--c-border)", borderTopColor: "var(--c-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--c-text-4)", fontSize: 14 }}>로딩 중...</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <>
        <style>{`body { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }`}</style>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--c-bg-soft)", gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="var(--c-border)" strokeWidth="2"/>
            <path d="M24 14V26M24 32V34" stroke="var(--c-text-4)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--c-text-2)" }}>접근 권한이 없습니다</p>
          <p style={{ fontSize: 14, color: "var(--c-text-4)", marginTop: -8 }}>관리자 계정으로 로그인해주세요</p>
          <Link
            href="/admin-login"
            className="press"
            style={{
              marginTop: 8,
              padding: "10px 24px",
              background: "var(--c-brand)",
              color: "#fff",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              border: "none",
            }}
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`body { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", background: "var(--c-bg-soft)" }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 40,
            }}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            height: "100dvh",
            maxHeight: "100dvh",
            background: "var(--c-inverse-4)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            // 데스크톱은 항상 펼쳐둔다. 예전엔 여기서도 sidebarOpen 을 봤는데,
            // 햄버거 버튼이 모바일 전용이라 데스크톱에선 열 방법이 없어 메뉴가
            // 영영 화면 밖(-240)에 숨어 있었다. 모바일 동작은 아래 미디어쿼리가 담당.
            left: 0,
            zIndex: 50,
            transition: "left 0.25s ease",
          }}
          className="admin-sidebar"
        >
          {/* Logo */}
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Image src="/icons/stady-logo.svg" alt="Stady" width={80} height={28} unoptimized style={{ filter: "brightness(0) invert(1)" }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>관리자 패널</p>
          </div>

          {/* Nav (좁은 화면에서 항목이 넘치면 이 영역만 스크롤) */}
          <nav style={{ padding: "12px 10px", flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                    background: isActive ? "var(--c-brand)" : "transparent",
                    textDecoration: "none",
                    marginBottom: 2,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Back to app */}
          <div style={{ padding: "8px 10px" }}>
            <Link
              href="/"
              onClick={() => setSidebarOpen(false)}
              className="press"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.06)",
                textDecoration: "none",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M11 15L6 10L11 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>앱으로 돌아가기</span>
            </Link>
          </div>

          {/* User info */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--c-brand)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, color: "#fff",
              }}>
                {user.nickname.charAt(0)}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{user.nickname}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>관리자</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <div
          className="admin-mobile-header"
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 56,
            background: "var(--c-inverse-4)",
            zIndex: 30,
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <MenuIcon size={24} />
          </button>
          <Image src="/icons/stady-logo.svg" alt="Stady" width={60} height={20} style={{ filter: "brightness(0) invert(1)" }} />
          <Link
            href="/"
            className="press"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "rgba(255,255,255,0.12)",
              textDecoration: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M11 15L6 10L11 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            앱으로
          </Link>
        </div>

        {/* Content */}
        <main className="admin-content" style={{ flex: 1, marginLeft: 240, padding: 32, minHeight: "100vh", overflowX: "auto" }}>
          {children}
        </main>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar {
            left: ${sidebarOpen ? "0" : "-240px"} !important;
          }
          .admin-mobile-header {
            display: flex !important;
          }
          .admin-content {
            margin-left: 0 !important;
            padding: 72px 16px 24px !important;
          }
        }
      `}</style>
    </>
  );
}
