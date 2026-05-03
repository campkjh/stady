"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setNickname(data.user.nickname ?? "");
        setStatusMessage(data.user.statusMessage ?? "");
        setAvatar(data.user.avatar ?? null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize image to max 200x200 to keep base64 small
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 200;
      let w = img.width;
      let h = img.height;
      if (w > h) { h = (h / w) * maxSize; w = maxSize; }
      else { w = (w / h) * maxSize; h = maxSize; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setAvatar(dataUrl);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nickname, avatar, statusMessage }),
      });
      if (res.ok) {
        router.back();
      } else {
        alert("저장에 실패했습니다.");
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", padding: "12px 10px" }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="press"
          style={{ background: "none", border: "none", padding: 4 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px 0" }}>
        {/* Avatar */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {avatar ? (
              <img src={avatar} alt="프로필" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="press"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Nickname */}
        <div style={{ width: "100%" }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            닉네임
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임을 입력해주세요"
            style={{
              width: "100%",
              height: 48,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: "#F3F4F6",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status Message */}
        <div style={{ width: "100%", marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151" }}>
              상태메세지
            </label>
            <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700 }}>
              {statusMessage.length}/5
            </span>
          </div>
          <input
            type="text"
            value={statusMessage}
            maxLength={5}
            onChange={(e) => setStatusMessage(e.target.value.slice(0, 5))}
            placeholder="최대 5글자"
            style={{
              width: "100%",
              height: 48,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: "#F3F4F6",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Withdraw */}
        <div style={{ width: "100%", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setShowWithdraw(true)}
            style={{ background: "none", border: "none", fontSize: 13, color: "#3787FF", cursor: "pointer" }}
          >
            회원탈퇴
          </button>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowWithdraw(false)} />
          <div style={{ position: "relative", width: "calc(100% - 32px)", maxWidth: 375, backgroundColor: "#fff", borderRadius: 20, padding: 12, boxShadow: "0 4px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D" }}>정말 탈퇴하시겠습니까?</h2>
              <p style={{ fontSize: 14, color: "#8A909C", marginTop: 6, lineHeight: 1.5 }}>
                탈퇴 시 모든 데이터가 삭제되며<br/>복구할 수 없습니다.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowWithdraw(false)}
                className="press"
                style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F2F3F5", color: "#51535C", fontSize: 16, fontWeight: 700, border: "none" }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={withdrawing}
                onClick={async () => {
                  setWithdrawing(true);
                  try {
                    await fetch("/api/profile", { method: "DELETE", credentials: "include" });
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/login");
                  } catch {
                    alert("탈퇴 처리 중 오류가 발생했습니다.");
                    setWithdrawing(false);
                  }
                }}
                className="press"
                style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#EF4444", color: "#fff", fontSize: 16, fontWeight: 700, border: "none", opacity: withdrawing ? 0.6 : 1 }}
              >
                {withdrawing ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div style={{ padding: "16px 20px 40px" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="press"
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            background: "#292A2E",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
