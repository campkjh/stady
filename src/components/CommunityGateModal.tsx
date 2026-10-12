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
    <div role="dialog" aria-modal="true" className="mdl-root" style={{ zIndex: 120, padding: 20 }}>
      <div className="mdl-dim" />
      <div className="mdl-card is-wide">
        <div className="mdl-text" style={{ textAlign: "center" }}>
          <h2 className="mdl-title" style={{ fontSize: 22 }}>
            준비
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              aria-label="커뮤니티 암호 입력 열기"
              style={{
                appearance: "none", border: "none", background: "transparent", color: "inherit",
                padding: 0, margin: 0, font: "inherit", lineHeight: "inherit", cursor: "default",
                textDecoration: "none", outline: "none",
              }}
            >
              중
            </button>
            입니다.
          </h2>
          {passwordOpen && (
            <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <input
                type="password"
                className={`mdl-field${error ? " is-error" : ""}`}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="암호 입력"
                autoFocus
                style={{ textAlign: "center" }}
              />
              {error && <span className="mdl-error" style={{ marginTop: 0 }}>{error}</span>}
              <button type="submit" className="mdl-btn is-main" style={{ flex: "none", width: "100%" }}>
                입장
              </button>
            </form>
          )}
        </div>
        <div className="mdl-textrow" style={{ justifyContent: "center", paddingTop: 12 }}>
          <button type="button" className="mdl-textbtn is-muted" onClick={close}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
