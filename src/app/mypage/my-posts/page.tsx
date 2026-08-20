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
    // body가 flex-col이라 가로 auto 마진만 있으면 fit-content로 쪼그라듦 → width 100% 필수
    <div style={{ width: "100%", minHeight: "100vh", background: "var(--c-bg)", maxWidth: 720, margin: "0 auto" }}>
      <BackHeader title="내가 쓴 글" />

      {loading ? (
        <div style={centerBox}>
          <div style={spinner} />
        </div>
      ) : posts.length === 0 ? (
        <div style={centerBox}>
          <p style={{ color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>작성한 글이 없어요</p>
        </div>
      ) : (
        <div style={{ padding: "8px 20px 28px" }}>
          <div style={card}>
            {posts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/community/${p.id}`)}
                className="press"
                style={{ ...itemRow, borderBottom: i < posts.length - 1 ? "1px solid var(--c-bg-muted)" : "none" }}
              >
                {p.groupName && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-brand-b)" }}>{p.groupName}</span>
                )}
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {p.title}
                </p>
                <p style={{ fontSize: 14, color: "var(--c-text-3)", margin: "5px 0 0", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.content}
                </p>
                <p style={{ fontSize: 12, color: "var(--c-text-5)", margin: "8px 0 0", fontWeight: 600 }}>
                  {new Date(p.createdAt).toLocaleDateString("ko-KR")} · 좋아요 {p.likeCount} · 댓글 {p.commentCount}
                </p>
              </button>
            ))}
          </div>
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
  border: "4px solid var(--c-border)",
  borderTopColor: "var(--c-brand)",
  animation: "mpspin 0.8s linear infinite",
} as const;

const card = {
  borderRadius: 18,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg)",
  overflow: "hidden",
} as const;

const itemRow = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  padding: "14px 18px",
  background: "none",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
} as const;
