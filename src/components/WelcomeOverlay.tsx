"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const keyframesStyle = `
@keyframes welcomeFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes welcomeFadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes welcomeFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes welcomeCheck {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
`;

interface WelcomeOverlayProps {
  nickname: string;
  onComplete: () => void;
}

export default function WelcomeOverlay({ nickname, onComplete }: WelcomeOverlayProps) {
  const [step, setStep] = useState<"greeting" | "thanks">("greeting");
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // 스크롤 방지
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.maxWidth = "500px";

    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;

    const t1 = setTimeout(async () => {
      // 유입경로 질문은 제거됨 — 초대코드(리퍼럴)가 있으면 조용히 적용
      const code = (localStorage.getItem("stady_pending_invite_code") || "").trim();
      if (code) {
        try {
          const res = await fetch("/api/auth/signup-source", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteCode: code }),
          });
          if (res.ok) localStorage.removeItem("stady_pending_invite_code");
        } catch {
          // ignore
        }
      }
      setStep("thanks");
      t2 = setTimeout(() => {
        setFadingOut(true);
        t3 = setTimeout(() => onComplete(), 500);
      }, 1500);
    }, 1500);

    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.maxWidth = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{keyframesStyle}</style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          animation: fadingOut ? "welcomeFadeOut 0.5s forwards" : "welcomeFadeIn 0.5s forwards",
        }}
      >
        {/* Greeting */}
        <p
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: step === "thanks" ? 16 : 0,
            animation: "welcomeFadeInUp 0.6s forwards",
          }}
        >
          환영합니다 {nickname}님!
        </p>

        {/* Thanks */}
        {step === "thanks" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              animation: "welcomeFadeInUp 0.5s forwards",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: "#22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "welcomeCheck 0.5s forwards",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>스타디에 오신 걸 환영해요!</p>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
