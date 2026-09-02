"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 닉네임이 다른 사용자와 중복인 사람에게 접속 시 강제로 뜨는 변경 팝업.
// 닫기 없음 — 유일한 닉네임을 저장해야만 사라진다. (기존 중복자 정리 + 이후 중복 방지의 마지막 관문)
//
// NoticePopup 과 동일한 WebView 안전 패턴을 따른다:
//   document.body 포털 / 등장 애니메이션 없음 / inset 대신 top·right·bottom·left.
const MAX = 16;

export default function NicknameGate() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/nickname", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.duplicate === true) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    const next = value.replace(/\s+/g, " ").trim();
    if (next.length < 2) {
      setError("닉네임은 최소 2자 이상이어야 해요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me/nickname", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nickname: next }),
      });
      if (res.ok) {
        setOpen(false);
        // 닉네임이 곳곳(헤더·커뮤니티)에 캐시로 남아 있어, 반영을 위해 한 번 새로고침.
        setTimeout(() => {
          try {
            window.location.reload();
          } catch {
            /* ignore */
          }
        }, 50);
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "변경에 실패했어요. 다른 이름을 입력해 주세요.");
    } catch {
      setError("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 3000,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--c-bg)",
          borderRadius: 20,
          padding: "24px 20px 20px",
          border: "1px solid rgba(15,23,42,0.06)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 12 }}>✏️</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 900, color: "var(--c-text-b)" }}>
          닉네임을 바꿔주세요
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: "var(--c-text-2d)" }}>
          다른 사용자와 닉네임이 겹쳐요. 나만의 닉네임으로 바꿔야 계속 이용할 수 있어요.
        </p>

        <input
          type="text"
          value={value}
          maxLength={MAX}
          autoFocus
          placeholder="새 닉네임 (2~16자)"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) save();
          }}
          style={{
            width: "100%",
            height: 50,
            padding: "0 14px",
            borderRadius: 12,
            border: `1.5px solid ${error ? "#E5484D" : "var(--c-bg-muted-3)"}`,
            background: "var(--c-bg-muted)",
            fontSize: 16, // iOS 확대 방지
            color: "var(--c-text-b)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ minHeight: 18, marginTop: 7 }}>
          {error && <span style={{ fontSize: 12.5, color: "#E5484D", fontWeight: 700 }}>{error}</span>}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            width: "100%",
            height: 50,
            marginTop: 6,
            border: "none",
            borderRadius: 12,
            background: "var(--c-brand)",
            color: "#fff",
            fontSize: 15.5,
            fontWeight: 900,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? "저장 중…" : "이 닉네임으로 변경"}
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
