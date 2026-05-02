"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

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
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/admin/workbooks",
    label: "문제집 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4C3 2.89543 3.89543 2 5 2H15C16.1046 2 17 2.89543 17 4V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V4Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 6H13M7 10H13M7 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/ox-quiz",
    label: "OX퀴즈 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13 6L17 14M17 6L13 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/vocab-quiz",
    label: "영단어퀴즈 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V5Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 7H8L10 13L12 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/banners",
    label: "배너 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="4" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 12L8 9L10.5 11.5L12 10L15 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="13.5" cy="7.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: "/admin/inquiries",
    label: "문의 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V12C17 13.1046 16.1046 14 15 14H8L4 17V14H5C3.89543 14 3 13.1046 3 12V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M7 8H13M7 11H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <>
        <style>{`body { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }`}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #E5E7EB", borderTopColor: "#3787FF", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#8A909C", fontSize: 14 }}>로딩 중...</p>
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
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F9FAFB", gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#E5E7EB" strokeWidth="2"/>
            <path d="M24 14V26M24 32V34" stroke="#8A909C" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#2B313D" }}>접근 권한이 없습니다</p>
          <p style={{ fontSize: 14, color: "#8A909C", marginTop: -8 }}>관리자 계정으로 로그인해주세요</p>
          <Link
            href="/admin-login"
            className="press"
            style={{
              marginTop: 8,
              padding: "10px 24px",
              background: "#3787FF",
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
      <div style={{ minHeight: "100vh", display: "flex", background: "#F9FAFB" }}>
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
            minHeight: "100vh",
            background: "#1E1F23",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            left: sidebarOpen ? 0 : -240,
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

          {/* Nav */}
          <nav style={{ padding: "12px 10px", flex: 1 }}>
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                    background: isActive ? "#3787FF" : "transparent",
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

          {/* User info */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#3787FF", display: "flex", alignItems: "center", justifyContent: "center",
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
            background: "#1E1F23",
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <Image src="/icons/stady-logo.svg" alt="Stady" width={60} height={20} style={{ filter: "brightness(0) invert(1)" }} />
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
