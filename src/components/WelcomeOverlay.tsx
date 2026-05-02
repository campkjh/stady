"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const SOURCE_OPTIONS = [
  "인스타그램",
  "유튜브",
  "블로그",
  "지인 추천",
  "검색 (네이버/구글)",
  "기타",
];

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
  const [step, setStep] = useState<"greeting" | "question" | "thanks">("greeting");
  const [fadingOut, setFadingOut] = useState(false);
  const [inviteCode, setInviteCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("stady_pending_invite_code") || "";
  });

  useEffect(() => {
    // 스크롤 방지
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.maxWidth = "500px";
    const timer = setTimeout(() => setStep("question"), 1500);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.maxWidth = "";
    };
  }, []);

  const handleSelect = async (source: string) => {
    try {
      const res = await fetch("/api/auth/signup-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, inviteCode: inviteCode.trim() }),
      });
      if (res.ok && inviteCode.trim()) {
        localStorage.removeItem("stady_pending_invite_code");
      }
    } catch {
      // ignore errors
    }
    setStep("thanks");
    setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => onComplete(), 500);
    }, 1500);
  };

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
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Greeting */}
        <p
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 16,
            animation: "welcomeFadeInUp 0.6s forwards",
          }}
        >
          환영합니다 {nickname}님!
        </p>

        {/* Question */}
        {(step === "question" || step === "thanks") && step !== "thanks" && (
          <>
            <p
              style={{
                color: "#fff",
                fontSize: 16,
                marginBottom: 24,
                animation: "welcomeFadeInUp 0.6s forwards",
              }}
            >
              어떤 경로로 오셨나요?
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                width: "80%",
                maxWidth: 320,
              }}
            >
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="초대코드가 있다면 입력"
                autoCapitalize="characters"
                style={{
                  height: 44,
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.95)",
                  color: "#111827",
                  padding: "0 16px",
                  fontSize: 15,
                  fontWeight: 700,
                  outline: "none",
                  textAlign: "center",
                  animation: "welcomeFadeInUp 0.5s 0.08s both",
                }}
              />
              {SOURCE_OPTIONS.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  style={{
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#fff",
                    color: "#2B313D",
                    fontSize: 15,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    animation: `welcomeFadeInUp 0.5s ${0.1 * (i + 1)}s both`,
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}

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
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>감사합니다!</p>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
