"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        setError(data.error || "로그인에 실패했습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    fontSize: 15,
    color: "#2B313D",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#2B313D",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #E5E7EB",
          padding: "40px 32px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image
            src="/icons/stady-logo.svg"
            alt="Stady"
            width={100}
            height={36}
            style={{ margin: "0 auto 16px", display: "block" }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#2B313D" }}>
            관리자 로그인
          </h1>
          <p style={{ fontSize: 14, color: "#8A909C", marginTop: 6 }}>
            관리자 계정으로 로그인해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3787FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3787FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
              required
            />
          </div>

          {error && (
            <div
              style={{
                background: "#FEF2F2",
                color: "#DC2626",
                fontSize: 13,
                fontWeight: 500,
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="press"
            style={{
              width: "100%",
              padding: "12px 0",
              background: "#3787FF",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
