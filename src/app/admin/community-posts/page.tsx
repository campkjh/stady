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

  useEffect(() => {
    fetch("/api/admin/community-posts", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
        setPosts(data.posts || []);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>게시글 관리</h1>
        <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 14 }}>커뮤니티 게시글과 태그 연결 상태를 확인합니다.</p>
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
            <article key={post.id} style={{ padding: 18, borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ color: "#111827", fontSize: 16 }}>{post.title}</strong>
                <span style={{ color: post.isActive ? "#047857" : "#6B7280", fontSize: 12, fontWeight: 800 }}>
                  {post.isActive ? "노출" : "비노출"}
                </span>
              </div>
              <p style={{ margin: "8px 0", color: "#6B7280", fontSize: 13 }}>
                {post.groupName} · {post.nickname} · {new Date(post.createdAt).toLocaleString("ko-KR")}
              </p>
              <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14, lineHeight: 1.55 }}>{post.content}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {post.tags.map((tag) => (
                  <span key={tag.id} style={{ borderRadius: 999, background: "#F3F4F6", color: "#4B5563", padding: "5px 9px", fontSize: 12, fontWeight: 700 }}>
                    #{tag.name}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
