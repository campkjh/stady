"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";
import BackHeader from "@/components/BackHeader";

interface Post {
  id: string;
  userId: string;
  groupName: string | null;
  title: string;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

export default function MyPostsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meRes.ok) {
          setAuthed(false);
          return;
        }
        const me = await meRes.json();
        if (!me.user) {
          setAuthed(false);
          return;
        }
        setAuthed(true);
        const res = await fetch("/api/community/posts", { credentials: "include" });
        const data = await res.json();
        const mine: Post[] = (data.posts || []).filter((p: Post) => p.userId === me.user.id);
        setPosts(mine);
      } catch {
        setAuthed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (authed === false) return <LoginRequired />;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", maxWidth: 500, margin: "0 auto" }}>
      <BackHeader title="내가 쓴 글" />

      {loading ? (
        <div style={centerBox}>
          <div style={spinner} />
        </div>
      ) : posts.length === 0 ? (
        <div style={centerBox}>
          <p style={{ color: "#8B95A1", fontSize: 15, fontWeight: 500 }}>작성한 글이 없어요</p>
        </div>
      ) : (
        <div style={{ padding: "8px 0" }}>
          {posts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/community/${p.id}`)}
              className="press"
              style={itemRow}
            >
              {p.groupName && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3182F6" }}>{p.groupName}</span>
              )}
              <p style={{ fontSize: 15.5, fontWeight: 700, color: "#191F28", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
              </p>
              <p style={{ fontSize: 13.5, color: "#6B7280", margin: "5px 0 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.content}
              </p>
              <p style={{ fontSize: 12.5, color: "#B0B8C1", margin: "8px 0 0", fontWeight: 500 }}>
                {new Date(p.createdAt).toLocaleDateString("ko-KR")} · 좋아요 {p.likeCount} · 댓글 {p.commentCount}
              </p>
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes mpspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const centerBox = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "60vh",
} as const;

const spinner = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "4px solid #E5E7EB",
  borderTopColor: "#3787FF",
  animation: "mpspin 0.8s linear infinite",
} as const;

const itemRow = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  padding: "16px 20px",
  background: "none",
  border: "none",
  borderBottom: "1px solid #F5F6F8",
  textAlign: "left",
  cursor: "pointer",
} as const;
