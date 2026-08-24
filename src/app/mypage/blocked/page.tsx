"use client";

import { useCallback, useEffect, useState } from "react";
import LoginRequired from "@/components/LoginRequired";
import BackHeader from "@/components/BackHeader";

// 차단한 사용자 목록 / 해제 화면.
// 커뮤니티에서 "이 사용자 차단하기"로 숨긴 사람을 여기서 되돌린다.

interface BlockedUser {
  userId: string;
  nickname: string;
  createdAt: string;
}

export default function BlockedUsersPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/community/blocks", { credentials: "include" });
      if (response.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "불러오지 못했어요.");
      setAuthed(true);
      setBlocks(data.blocks || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unblock(userId: string) {
    setBusyId(userId);
    try {
      // 같은 토글 API — 이미 차단된 상대라 호출하면 해제된다.
      const response = await fetch("/api/community/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "해제하지 못했어요.");
      setBlocks((prev) => prev.filter((item) => item.userId !== userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "해제하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  if (authed === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <BackHeader title="차단한 사용자" />
      <div style={{ padding: "8px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
        <p style={{ margin: "10px 0 18px", fontSize: 13.5, color: "var(--c-text-4b)", lineHeight: 1.6 }}>
          차단한 사용자의 글과 댓글은 커뮤니티에서 보이지 않아요. 차단 사실은 상대에게 알려지지 않습니다.
        </p>

        {message && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--c-danger-h)" }}>{message}</p>
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: "var(--c-text-4b)" }}>불러오는 중…</p>
        ) : blocks.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--c-text-4b)" }}>차단한 사용자가 없어요.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {blocks.map((item) => (
              <li
                key={item.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid var(--c-border)",
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.nickname}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--c-text-4b)", marginTop: 2 }}>
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")} 차단
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => unblock(item.userId)}
                  disabled={busyId === item.userId}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: "var(--c-bg-muted-2)",
                    color: "var(--c-text-3b)",
                    cursor: busyId === item.userId ? "default" : "pointer",
                    opacity: busyId === item.userId ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {busyId === item.userId ? "처리 중…" : "차단 해제"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
