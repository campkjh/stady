"use client";

import { useEffect, useState } from "react";

interface AdminComment {
  id: string;
  postId: string;
  postTitle: string;
  parentId: string | null;
  nickname: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/community-comments", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "댓글을 불러오지 못했습니다.");
        setComments(data.comments || []);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "댓글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (c: AdminComment) => {
    setBusyId(c.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/community-comments/${c.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리에 실패했습니다.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: AdminComment) => {
    if (!window.confirm("이 댓글을 영구 삭제할까요? 대댓글도 함께 삭제되며 되돌릴 수 없습니다.")) return;
    setBusyId(c.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/community-comments/${c.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "var(--c-text)", fontSize: 26, fontWeight: 900 }}>댓글 관리</h1>
      {message && (
        <div style={{ border: "1px solid var(--c-danger-line)", background: "var(--c-danger-soft)", color: "var(--c-danger-deep)", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
          {message}
        </div>
      )}
      <div style={{ border: "1px solid var(--c-border)", borderRadius: 8, background: "var(--c-bg)", overflow: "hidden" }}>
        {loading ? (
          <p style={{ margin: 0, padding: 20, color: "var(--c-text-3)", fontSize: 14 }}>불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p style={{ margin: 0, padding: 20, color: "var(--c-text-3)", fontSize: 14 }}>등록된 댓글이 없습니다.</p>
        ) : (
          comments.map((c) => (
            <article key={c.id} style={{ padding: 16, borderBottom: "1px solid var(--c-bg-muted)", opacity: c.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "var(--c-text-3)", fontSize: 12 }}>
                  {c.parentId ? "↳ 대댓글 · " : ""}{c.nickname} · {new Date(c.createdAt).toLocaleString("ko-KR")}
                </span>
                <span style={{ color: c.isActive ? "var(--c-success-c)" : "var(--c-text-3)", fontSize: 12, fontWeight: 800 }}>
                  {c.isActive ? "노출" : "비노출"}
                </span>
              </div>
              <p style={{ margin: "8px 0 6px", color: "var(--c-text-2c)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.content}</p>
              <p style={{ margin: "0 0 10px", color: "var(--c-text-4c)", fontSize: 12 }}>게시글: {c.postTitle}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleActive(c)} disabled={busyId === c.id} style={btnGhost}>
                  {c.isActive ? "비노출" : "노출"}
                </button>
                <button onClick={() => remove(c)} disabled={busyId === c.id} style={btnDanger}>삭제</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

const btnBase = {
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost = { ...btnBase, background: "var(--c-bg-muted)", color: "var(--c-text-2c)" };
const btnDanger = { ...btnBase, background: "var(--c-danger-soft)", color: "var(--c-danger-c)", border: "1px solid var(--c-danger-line)" };
