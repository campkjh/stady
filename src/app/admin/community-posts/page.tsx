"use client";

import { useEffect, useState } from "react";

interface AdminPost {
  id: string;
  nickname: string;
  groupName: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  tags: { id: string; name: string }[];
}

export default function AdminCommunityPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/community-posts", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
        setPosts(data.posts || []);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (post: AdminPost) => {
    setEditId(post.id);
    setEditTitle(post.title);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/community-posts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정에 실패했습니다.");
      cancelEdit();
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수정에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (post: AdminPost) => {
    setBusyId(post.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/community-posts/${post.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !post.isActive }),
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

  const removePost = async (post: AdminPost) => {
    if (!window.confirm(`"${post.title}" 게시글을 영구 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusyId(post.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/community-posts/${post.id}`, {
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
    <section className="jc-admin" style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, color: JC.title, fontSize: 26, fontWeight: 700 }}>게시글 관리</h1>
        <p style={{ margin: "8px 0 0", color: JC.sub, fontSize: 14, fontWeight: 400 }}>커뮤니티 게시글을 편집·노출 조정·삭제할 수 있습니다.</p>
      </div>
      {message && (
        <div style={{ border: "1px solid var(--c-danger-line)", background: "var(--c-danger-soft)", color: "var(--c-danger-deep)", borderRadius: 13, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}
      <div style={cardStyle}>
        {loading ? (
          <p style={{ margin: 0, padding: 24, color: JC.sub, fontSize: 14 }}>불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p style={{ margin: 0, padding: 24, color: JC.sub, fontSize: 14 }}>등록된 게시글이 없습니다.</p>
        ) : (
          posts.map((post, index) => (
            <article
              key={post.id}
              style={{
                padding: 20,
                borderBottom: index === posts.length - 1 ? "none" : `1px solid ${JC.soft}`,
                opacity: post.isActive ? 1 : 0.6,
              }}
            >
              {editId === post.id ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목"
                    style={inputStyle}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="내용"
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(post.id)} disabled={busyId === post.id} style={btnPrimary}>저장</button>
                    <button onClick={cancelEdit} disabled={busyId === post.id} style={btnGhost}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong style={{ color: JC.title, fontSize: 16, fontWeight: 700 }}>{post.title}</strong>
                    <span style={post.isActive ? chipAccent : chipNeutral}>
                      {post.isActive ? "노출" : "비노출"}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0", color: JC.sub, fontSize: 13, fontWeight: 400 }}>
                    {post.groupName} · {post.nickname} · {new Date(post.createdAt).toLocaleString("ko-KR")}
                  </p>
                  <p style={{ margin: "0 0 12px", color: JC.body, fontSize: 14, fontWeight: 500, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.content}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {post.tags.map((tag) => (
                      <span key={tag.id} style={chipNeutral}>
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => startEdit(post)} disabled={busyId === post.id} style={btnGhost}>편집</button>
                    <button onClick={() => toggleActive(post)} disabled={busyId === post.id} style={btnGhost}>
                      {post.isActive ? "비노출" : "노출"}
                    </button>
                    <button onClick={() => removePost(post)} disabled={busyId === post.id} style={btnDanger}>삭제</button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </div>
      <style>{JC_FOCUS_CSS}</style>
    </section>
  );
}

/* 인라인 style 로는 :focus 를 못 준다. 포커스 테두리만 클래스로 뺀다.
   page.tsx 는 default 외 named export 가 금지라 모듈 로컬 상수로 둔다. */
const JC_FOCUS_CSS = `
  .jc-admin input:focus,
  .jc-admin textarea:focus,
  .jc-admin select:focus { border-color: #3180F7 !important; }
`;

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${JC.soft}`,
  borderRadius: 13,
  padding: "11px 14px",
  fontSize: 14,
  color: JC.title,
  background: "var(--c-bg)",
  outline: "none",
  boxSizing: "border-box" as const,
};

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 13,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = { ...btnBase, background: JC.accent, color: "#fff", fontWeight: 700 };
const btnGhost: React.CSSProperties = { ...btnBase, background: JC.soft, color: JC.body };
const btnDanger: React.CSSProperties = { ...btnBase, background: "var(--c-danger-soft)", color: "var(--c-danger-c)", border: "1px solid var(--c-danger-line)" };
