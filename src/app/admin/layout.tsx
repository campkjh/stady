"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MenuIcon } from "@/components/admin/admin-icons";

// 제이씨랩 자가견적(jaicylab.com/estimate) 톤.
// 면/테두리/텍스트는 globals.css 토큰에 같은 값이 있으므로 토큰을 쓴다.
//   #FFFFFF -> var(--c-bg)          (사이드바·카드 면)
//   #F2F3F5 -> var(--c-bg-muted-3)  (보조 면 · 유일한 경계선 · 본문 배경)
//   #EAF2FF -> var(--c-brand-soft-6)(활성/강조 배경)
//   #2B313D -> var(--c-text-2)      (제목)
//   #51535C -> var(--c-text-3c)     (본문/라벨)
// 아래 두 색만 대응 토큰이 없어 hex 로 고정한다(어드민은 라이트 고정).
const ACCENT = "#3180F7"; // 강조 텍스트·활성 메뉴 글자
const MUTED = "#8A909C"; // 보조 텍스트

interface User {
  id: string;
  email: string;
  nickname: string;
  role: string;
}

// 컬러 아이콘(admin-color)은 currentColor 가 아니라 SVG 안에 색이 박혀 있다.
// 그래서 <img> 로 그대로 띄우고, 활성/비활성 구분은 filter 가 아니라 opacity 로만 한다.
// (filter: invert/brightness 를 걸면 다색 그림이 뭉개진다.)
const navItems = [
  { href: "/admin", label: "대시보드", icon: "/icons/admin-color/nav-dashboard.svg" },
  { href: "/admin/insights", label: "사용자 인사이트", icon: "/icons/admin-color/nav-insights.svg" },
  { href: "/admin/community-posts", label: "게시글 관리", icon: "/icons/admin-color/nav-posts.svg" },
  { href: "/admin/comments", label: "댓글 관리", icon: "/icons/admin-color/nav-comments.svg" },
  { href: "/admin/category-groups", label: "카테고리 관리", icon: "/icons/admin-color/nav-categories.svg" },
  { href: "/admin/tags", label: "태그 관리", icon: "/icons/admin-color/nav-tags.svg" },
  { href: "/admin/reports", label: "신고·차단 관리", icon: "/icons/admin-color/nav-reports.svg" },
  { href: "/admin/workbooks", label: "문제집 관리", icon: "/icons/admin-color/nav-workbooks.svg" },
  { href: "/admin/users", label: "사용자 관리", icon: "/icons/admin-color/nav-users.svg" },
  { href: "/admin/payments", label: "결제 관리", icon: "/icons/admin-color/nav-payments.svg" },
  { href: "/admin/ox-quiz", label: "OX퀴즈 관리", icon: "/icons/admin-color/nav-ox.svg" },
  { href: "/admin/vocab-quiz", label: "영단어퀴즈 관리", icon: "/icons/admin-color/nav-vocab.svg" },
  { href: "/admin/banners", label: "배너 관리", icon: "/icons/admin-color/nav-banners.svg" },
  { href: "/admin/inquiries", label: "문의 관리", icon: "/icons/admin-color/nav-inquiries.svg" },
  { href: "/admin/surveys", label: "설문 결과", icon: "/icons/admin-color/nav-surveys.svg" },
  { href: "/admin/notices", label: "공지사항 관리", icon: "/icons/admin-color/nav-notices.svg" },
  { href: "/admin/faqs", label: "FAQ 관리", icon: "/icons/admin-color/nav-faqs.svg" },
  { href: "/admin/mock-exams", label: "모의고사 관리", icon: "/icons/admin-color/nav-mockexams.svg" },
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
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg-muted-3)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--c-bg-muted-20)", borderTopColor: ACCENT, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}>로딩 중...</p>
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
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg-muted-3)", padding: 20 }}>
          {/* 흰 카드 + 1px 경계 + 라운드 18, 그림자 없음 */}
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              background: "var(--c-bg)",
              border: "1px solid var(--c-bg-muted-3)",
              borderRadius: 18,
              boxShadow: "none",
              padding: "40px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* 아이콘 타일: 보조 면 위에 강조색 그림 */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 13,
                background: "var(--c-brand-soft-6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.5" stroke={ACCENT} strokeWidth="1.6" />
                <path d="M12 7V13M12 16V16.5" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text-2)" }}>접근 권한이 없습니다</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: MUTED, marginTop: 8 }}>관리자 계정으로 로그인해주세요</p>
            <Link
              href="/admin-login"
              className="press"
              style={{
                marginTop: 24,
                width: "100%",
                padding: "13px 24px",
                background: ACCENT,
                color: "#fff",
                borderRadius: 13,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                border: "none",
                boxShadow: "none",
              }}
            >
              로그인 페이지로 이동
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`body { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", background: "var(--c-bg)" }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(43,49,61,0.32)",
              zIndex: 40,
            }}
          />
        )}

        {/* Sidebar — 흰 면 + 오른쪽 1px 경계가 전부. 그림자 없음. */}
        <aside
          style={{
            width: 248,
            height: "100dvh",
            maxHeight: "100dvh",
            background: "var(--c-bg)",
            borderRight: "1px solid var(--c-bg-muted-3)",
            boxShadow: "none",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            // 데스크톱은 항상 펼쳐둔다. 예전엔 여기서도 sidebarOpen 을 봤는데,
            // 햄버거 버튼이 모바일 전용이라 데스크톱에선 열 방법이 없어 메뉴가
            // 영영 화면 밖(-248)에 숨어 있었다. 모바일 동작은 아래 미디어쿼리가 담당.
            left: 0,
            zIndex: 50,
            transition: "left 0.25s ease",
          }}
          className="admin-sidebar"
        >
          {/* Logo */}
          <div style={{ padding: "26px 22px 18px" }}>
            {/* 흰 배경이므로 로고 반전 필터를 걷어낸다(로고 자체가 브랜드 블루). */}
            <Image src="/icons/stady-logo.svg" alt="Stady" width={80} height={28} unoptimized />
            <p style={{ fontSize: 12, fontWeight: 400, color: MUTED, marginTop: 8 }}>관리자 패널</p>
          </div>

          {/* Nav (좁은 화면에서 항목이 넘치면 이 영역만 스크롤) */}
          <nav style={{ padding: "4px 12px 12px", flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
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
                    padding: "11px 16px",
                    borderRadius: 13,
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? ACCENT : "var(--c-text-3c)",
                    background: isActive ? "var(--c-brand-soft-6)" : "transparent",
                    textDecoration: "none",
                    marginBottom: 3,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--c-bg-muted-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* 컬러 아이콘: 색 반전/filter 금지. 활성 여부는 투명도로만. */}
                  <img
                    src={item.icon}
                    alt=""
                    width={20}
                    height={20}
                    style={{ width: 20, height: 20, display: "block", flexShrink: 0, opacity: isActive ? 1 : 0.8 }}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Back to app */}
          <div style={{ padding: "8px 12px 0" }}>
            <Link
              href="/admin/capture"
              onClick={() => setSidebarOpen(false)}
              className="press"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderRadius: 13,
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                background: "#6C5CE0",
                textDecoration: "none",
                boxShadow: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>캡쳐용 화면</span>
            </Link>
          </div>

          <div style={{ padding: "8px 12px" }}>
            <Link
              href="/"
              onClick={() => setSidebarOpen(false)}
              className="press"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderRadius: 13,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--c-text-3c)",
                background: "var(--c-bg-muted-3)",
                textDecoration: "none",
                boxShadow: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M11 15L6 10L11 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>앱으로 돌아가기</span>
            </Link>
          </div>

          {/* User info */}
          <div style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--c-bg-muted-3)", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 999,
                background: "var(--c-brand-soft-6)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0,
              }}>
                {user.nickname.charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nickname}</p>
                <p style={{ fontSize: 11, fontWeight: 400, color: MUTED, marginTop: 2 }}>관리자</p>
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
            background: "var(--c-bg)",
            borderBottom: "1px solid var(--c-bg-muted-20)",
            boxShadow: "none",
            zIndex: 30,
            alignItems: "center",
            padding: "0 14px",
            gap: 10,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="메뉴 열기"
            style={{
              background: "none",
              border: "none",
              // 흰 상단바 위이므로 햄버거는 제목색(#2B313D)으로 대비를 잡는다.
              color: "var(--c-text-2)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <MenuIcon size={24} />
          </button>
          <Image src="/icons/stady-logo.svg" alt="Stady" width={60} height={20} unoptimized />
          <Link
            href="/admin/capture"
            className="press"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 13px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: "#6C5CE0",
              textDecoration: "none",
              boxShadow: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            캡쳐용
          </Link>
          <Link
            href="/"
            className="press"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--c-text-3c)",
              background: "var(--c-bg-muted-3)",
              textDecoration: "none",
              boxShadow: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M11 15L6 10L11 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            앱으로
          </Link>
        </div>

        {/* Content — 카드가 흰색으로 떠 보이게 보조 면(#F2F3F5) 위에 얹는다 */}
        {/* ⚠️ 본문 면은 흰색이어야 한다. 보조 면(칩·ghost 버튼·비활성 카드)이 #F2F3F5 인데
            배경까지 같은 색이면 그 요소들이 배경에 묻혀 통째로 사라진다
            — 실제로 신고 필터·'취소' 버튼·숨김 카드가 보이지 않았다. 제이씨랩도 콘텐츠 면은 흰색. */}
        <main className="admin-content" style={{ flex: 1, marginLeft: 248, padding: 32, minHeight: "100vh", overflowX: "auto", background: "var(--c-bg)" }}>
          {children}
        </main>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar {
            left: ${sidebarOpen ? "0" : "-248px"} !important;
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
