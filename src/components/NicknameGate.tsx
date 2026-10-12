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
    <div data-gate="nickname" className="mdl-root" style={{ zIndex: 3000, padding: 20 }}>
      <div className="mdl-dim" style={{ background: "rgba(0,0,0,0.55)" }} />
      <div className="mdl-card is-wide">
        <div className="mdl-text">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/toss/pencil.svg" alt="" className="mdl-icon" />
          <h2 className="mdl-title">닉네임을 바꿔주세요</h2>
          <p className="mdl-body is-sm">
            다른 사용자와 닉네임이 겹쳐요. 나만의 닉네임으로 바꿔야 계속 이용할 수 있어요.
          </p>
          <input
            type="text"
            className={`mdl-field${error ? " is-error" : ""}`}
            style={{ marginTop: 18 }}
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
          />
          <div style={{ minHeight: 22 }}>{error && <span className="mdl-error">{error}</span>}</div>
        </div>
        <div className="mdl-actions is-tight">
          <button type="button" className="mdl-btn is-main" onClick={save} disabled={saving}>
            {saving ? "저장 중…" : "이 닉네임으로 변경"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
