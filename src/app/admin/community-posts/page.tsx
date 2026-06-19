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
    <section style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>게시글 관리</h1>
        <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 14 }}>커뮤니티 게시글을 편집·노출 조정·삭제할 수 있습니다.</p>
      </div>
      {message && (
        <div style={{ border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
          {message}
        </div>
      )}
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
        {loading ? (
          <p style={{ margin: 0, padding: 20, color: "#6B7280", fontSize: 14 }}>불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p style={{ margin: 0, padding: 20, color: "#6B7280", fontSize: 14 }}>등록된 게시글이 없습니다.</p>
        ) : (
          posts.map((post) => (
            <article key={post.id} style={{ padding: 18, borderBottom: "1px solid #F3F4F6", opacity: post.isActive ? 1 : 0.6 }}>
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
                    <strong style={{ color: "#111827", fontSize: 16 }}>{post.title}</strong>
                    <span style={{ color: post.isActive ? "#047857" : "#6B7280", fontSize: 12, fontWeight: 800 }}>
                      {post.isActive ? "노출" : "비노출"}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0", color: "#6B7280", fontSize: 13 }}>
                    {post.groupName} · {post.nickname} · {new Date(post.createdAt).toLocaleString("ko-KR")}
                  </p>
                  <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{post.content}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {post.tags.map((tag) => (
                      <span key={tag.id} style={{ borderRadius: 999, background: "#F3F4F6", color: "#4B5563", padding: "5px 9px", fontSize: 12, fontWeight: 700 }}>
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
    </section>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
  boxSizing: "border-box" as const,
};

const btnBase = {
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnPrimary = { ...btnBase, background: "#3787FF", color: "#fff" };
const btnGhost = { ...btnBase, background: "#F3F4F6", color: "#374151" };
const btnDanger = { ...btnBase, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" };
