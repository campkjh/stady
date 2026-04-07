"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";

interface UserProfile {
  nickname: string;
  avatar: string | null;
  email: string;
}

const MENU_ITEMS = [
  {
    label: "프로필 설정",
    href: "/mypage/profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "공지사항",
    href: "/notice",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: "자주묻는질문",
    href: "/faq",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "고객센터",
    href: "/customer-center",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "모든약관",
    href: "/mypage/terms",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export default function MyPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setIsLoggedIn(true);
          setUser({ nickname: data.user.nickname, avatar: data.user.avatar, email: data.user.email });
        } else {
          setIsLoggedIn(false);
        }
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  if (isLoggedIn === null) return null;
  if (isLoggedIn === false) return <LoginRequired />;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Profile Section */}
      <div style={{ padding: "28px 16px 20px" }}>
        <button
          type="button"
          onClick={() => router.push("/mypage/profile")}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: "100%",
            background: "none",
            border: "none",
            textAlign: "left",
          }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#F3F4F6",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {user?.avatar ? (
              <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>{user?.nickname || "사용자"}</p>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>{user?.email || ""}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 6, background: "#F5F5F5" }} />

      {/* Menu List */}
      <div style={{ padding: "8px 0" }}>
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="press"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "15px 16px",
              textDecoration: "none",
              color: "#111",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <span style={{ flex: 1 }}>{item.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 6, background: "#F5F5F5" }} />

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "15px 16px",
          background: "none",
          border: "none",
          fontSize: 15,
          fontWeight: 500,
          color: "#9CA3AF",
        }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          backgroundColor: "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        로그아웃
      </button>

      {/* Footer */}
      <div style={{ padding: "24px 16px 16px" }}>
        <img src="/icons/stady-logo.svg" alt="Stady" style={{ width: 64, height: "auto", filter: "grayscale(100%)", opacity: 0.25, marginBottom: 12 }} />
        <div style={{ fontSize: 11, lineHeight: 1.8, color: "#C0C0C0" }}>
          <p>헬스스헬 | 우 06314  경기도 용인시 수지구 동천동 다웰빌리지 103동 102호</p>
          <p>T 01047269276 | E tlsdml0507@naver.com</p>
          <p>대표자 김지승 | 사업자 등록 번호 852-06-03583</p>
          <p>Copyright© stady. All right reserved.</p>
        </div>
      </div>
    </div>
  );
}
