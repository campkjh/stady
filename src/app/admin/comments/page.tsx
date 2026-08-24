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
    <section style={{ display: "grid", gap: 20 }}>
      <h1 style={{ margin: 0, color: JC.title, fontSize: 26, fontWeight: 700 }}>댓글 관리</h1>
      {message && (
        <div style={{ border: "1px solid var(--c-danger-line)", background: "var(--c-danger-soft)", color: "var(--c-danger-deep)", borderRadius: 13, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}
      <div style={cardStyle}>
        {loading ? (
          <p style={{ margin: 0, padding: 24, color: JC.sub, fontSize: 14 }}>불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p style={{ margin: 0, padding: 24, color: JC.sub, fontSize: 14 }}>등록된 댓글이 없습니다.</p>
        ) : (
          comments.map((c, index) => (
            <article
              key={c.id}
              style={{
                padding: 20,
                borderBottom: index === comments.length - 1 ? "none" : `1px solid ${JC.soft}`,
                opacity: c.isActive ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: JC.sub, fontSize: 12, fontWeight: 400 }}>
                  {c.parentId ? "↳ 대댓글 · " : ""}{c.nickname} · {new Date(c.createdAt).toLocaleString("ko-KR")}
                </span>
                <span style={c.isActive ? chipAccent : chipNeutral}>
                  {c.isActive ? "노출" : "비노출"}
                </span>
              </div>
              <p style={{ margin: "10px 0 6px", color: JC.body, fontSize: 14, fontWeight: 500, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</p>
              <p style={{ margin: "0 0 14px", color: JC.sub, fontSize: 12, fontWeight: 400 }}>게시글: {c.postTitle}</p>
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

/* 제이씨랩 자가견적(jaicylab.com/estimate) 톤.
   면=흰색, 보조면·경계=#F2F3F5, 강조=#EAF2FF/#3180F7, 그림자 없음. */
const JC = {
  soft: "var(--c-bg-muted-3)", // #F2F3F5
  accentBg: "var(--c-brand-soft-6)", // #EAF2FF
  title: "var(--c-text-2)", // #2B313D
  body: "var(--c-text-3c)", // #51535C
  sub: "#8A909C",
  accent: "#3180F7",
};

const cardStyle: React.CSSProperties = {
  border: `1px solid ${JC.soft}`,
  borderRadius: 18,
  background: "var(--c-bg)",
  overflow: "hidden",
  boxShadow: "none",
};

const chipBase: React.CSSProperties = {
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const chipAccent: React.CSSProperties = { ...chipBase, background: JC.accentBg, color: JC.accent };
const chipNeutral: React.CSSProperties = { ...chipBase, background: JC.soft, color: JC.body };

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 13,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = { ...btnBase, background: JC.soft, color: JC.body };
const btnDanger: React.CSSProperties = { ...btnBase, background: "var(--c-danger-soft)", color: "var(--c-danger-c)", border: "1px solid var(--c-danger-line)" };
