"use client";

import { FormEvent, useState } from "react";

interface CommunityGateModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

export const COMMUNITY_UNLOCK_KEY = "stady_community_unlocked";
export const COMMUNITY_PASSWORD = "1234";

export default function CommunityGateModal({ open, onClose, onUnlock }: CommunityGateModalProps) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function close() {
    setPasswordOpen(false);
    setPassword("");
    setError("");
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === COMMUNITY_PASSWORD) {
      sessionStorage.setItem(COMMUNITY_UNLOCK_KEY, "true");
      setPasswordOpen(false);
      setPassword("");
      setError("");
      onUnlock();
      return;
    }
    setError("암호가 올바르지 않습니다.");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(17, 24, 39, 0.45)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 8,
          background: "#fff",
          boxShadow: "0 18px 50px rgba(15,23,42,0.24)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "#111827", fontSize: 23, fontWeight: 700, letterSpacing: 0 }}>
          준비
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            aria-label="커뮤니티 암호 입력 열기"
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "inherit",
              padding: 0,
              margin: 0,
              font: "inherit",
              lineHeight: "inherit",
              cursor: "default",
              textDecoration: "none",
              outline: "none",
            }}
          >
            중
          </button>
          입니다.
        </p>
        {passwordOpen && (
          <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="암호 입력"
              autoFocus
              style={{
                width: "100%",
                border: "1px solid #D1D5DB",
                borderRadius: 8,
                padding: "12px 13px",
                color: "#111827",
                fontSize: 16,
                boxSizing: "border-box",
                textAlign: "center",
              }}
            />
            {error && <span style={{ color: "#DC2626", fontSize: 13, fontWeight: 500 }}>{error}</span>}
            <button
              type="submit"
              style={{
                border: "none",
                borderRadius: 8,
                background: "#3787FF",
                color: "#fff",
                padding: "12px 14px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              입장
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={close}
          style={{
            marginTop: 14,
            border: "none",
            background: "transparent",
            color: "#6B7280",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
