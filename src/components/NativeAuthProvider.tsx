"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Window 타입은 login/page.tsx에서 정의됨

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
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
  }, [router]);

  return <>{children}</>;
}
