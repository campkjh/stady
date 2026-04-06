"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        kakaoLogin?: { postMessage: (msg: string) => void };
        appleLogin?: { postMessage: (msg: unknown) => void };
      };
    };
    onKakaoLoginSuccess?: (token: string) => void;
    onKakaoLoginFail?: () => void;
    onAppleLoginSuccess?: (payload: { identityToken: string; firstName?: string; lastName?: string }) => void;
    onAppleLoginFail?: () => void;
  }
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // 카카오 네이티브 로그인 콜백
    window.onKakaoLoginSuccess = async (token: string) => {
      try {
        const res = await fetch("/api/auth/kakao/sdk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token }),
        });
        if (res.ok) {
          window.location.href = "/";
        } else {
          alert("로그인에 실패했습니다.");
        }
      } catch {
        alert("로그인 중 오류가 발생했습니다.");
      }
    };

    window.onKakaoLoginFail = () => {
      alert("로그인에 실패했습니다.");
    };

    // 애플 네이티브 로그인 콜백
    const handleAppleSuccess = async (e: Event) => {
      const { identityToken, firstName, lastName } = (e as CustomEvent).detail || {};
      try {
        const res = await fetch("/api/auth/apple/native-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identityToken, firstName, lastName }),
        });
        if (res.ok) {
          window.location.href = "/";
        } else {
          alert("로그인에 실패했습니다.");
        }
      } catch {
        alert("로그인 중 오류가 발생했습니다.");
      }
    };

    window.onAppleLoginSuccess = (payload) => {
      window.dispatchEvent(new CustomEvent("appleLoginSuccess", { detail: payload }));
    };

    window.onAppleLoginFail = () => {
      alert("로그인에 실패했습니다.");
    };

    window.addEventListener("appleLoginSuccess", handleAppleSuccess);

    return () => {
      delete window.onKakaoLoginSuccess;
      delete window.onKakaoLoginFail;
      delete window.onAppleLoginSuccess;
      delete window.onAppleLoginFail;
      window.removeEventListener("appleLoginSuccess", handleAppleSuccess);
    };
  }, []);

  function handleKakaoLogin() {
    // 디버깅용 alert
    alert("클릭됨! webkit: " + !!window.webkit?.messageHandlers?.kakaoLogin);

    if (window.webkit?.messageHandlers?.kakaoLogin) {
      window.webkit.messageHandlers.kakaoLogin.postMessage("login");
    } else {
      window.location.href = "/api/auth/kakao";
    }
  }

  function handleAppleLogin() {
    if (window.webkit?.messageHandlers?.appleLogin) {
      window.webkit.messageHandlers.appleLogin.postMessage({});
    } else {
      window.location.href = "/api/auth/apple";
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "40px 20px",
      backgroundColor: "#fff",
    }}>
      {/* Student Icon */}
      <div style={{ marginBottom: 24 }}>
        <img src="/icons/student.svg" alt="" style={{ width: 64, height: 64 }} />
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 4, textAlign: "center" }}>
        스타디
      </h1>
      <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 48, textAlign: "center" }}>
        학습의 시작, 스타디와 함께!
      </p>

      {/* Login Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
        <button
          type="button"
          onClick={handleKakaoLogin}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 48,
            borderRadius: 14,
            backgroundColor: "#FFC84D",
            color: "#3E1918",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="#3E1918">
            <path d="M10 1C5.03 1 1 4.13 1 8c0 2.38 1.56 4.47 3.93 5.7L4.1 17.1c-.08.3.25.55.52.4l3.53-2.09c.6.1 1.22.16 1.85.16 4.97 0 9-3.13 9-7S14.97 1 10 1z"/>
          </svg>
          카카오로 시작하기
        </button>

        <button
          type="button"
          onClick={handleAppleLogin}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 48,
            borderRadius: 14,
            backgroundColor: "#292A2E",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
          }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" fill="white">
            <path d="M14.94 11.58c-.02-2.27 1.86-3.37 1.95-3.42C15.86 6.6 14.46 6.41 13.96 6.39c-1.32-.14-2.6.78-3.27.78-.69 0-1.73-.77-2.85-.75-1.45.02-2.8.85-3.55 2.15-1.53 2.65-.39 6.56 1.08 8.71.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.52-.71 2.84-.71 1.32 0 1.7.71 2.85.68 1.18-.02 1.93-1.06 2.64-2.12.84-1.21 1.18-2.4 1.2-2.46-.03-.01-2.29-.88-2.31-3.49zM12.73 4.51c.59-.73 1-1.73.89-2.74-.86.04-1.92.58-2.54 1.3-.55.64-1.04 1.67-.91 2.65.96.07 1.95-.49 2.56-1.21z"/>
          </svg>
          Apple로 시작하기
        </button>
      </div>

      {/* Test Login (dev only) */}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "user@stady.com", password: "user1234" }),
          });
          router.push("/");
        }}
        style={{
          marginTop: 32,
          background: "none",
          border: "none",
          fontSize: 13,
          color: "#9CA3AF",
          textDecoration: "underline",
        }}
      >
        테스트 계정으로 로그인
      </button>
    </div>
  );
}
