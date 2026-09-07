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
interface MyComment {
  id: string;
  postId: string;
  postTitle: string;
  groupName: string | null;
  postActive: boolean;
  content: string;
  createdAt: string;
  likeCount: number;
}
type Tab = "posts" | "comments";

export default function MyPostsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [tab, setTab] = useState<Tab>("posts");

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
        const [res, cRes] = await Promise.all([
          fetch("/api/community/posts", { credentials: "include" }),
          fetch("/api/me/comments", { credentials: "include" }),
        ]);
        const data = await res.json();
        const mine: Post[] = (data.posts || []).filter((p: Post) => p.userId === me.user.id);
        setPosts(mine);
        const cData = cRes.ok ? await cRes.json() : { comments: [] };
        setComments(cData.comments || []);
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
      <BackHeader title="내가 쓴 글·댓글" />

      {/* 글 / 댓글 전환 탭 */}
      <div role="tablist" aria-label="내 활동 종류" style={segWrap}>
        {(["posts", "comments"] as Tab[]).map((t) => {
          const on = tab === t;
          const label = t === "posts" ? `글 ${loading ? "" : posts.length}` : `댓글 ${loading ? "" : comments.length}`;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t)}
              className="press"
              style={{ ...segBtn, background: on ? "var(--c-bg)" : "transparent", color: on ? "var(--c-text)" : "var(--c-text-4)", boxShadow: on ? "0 1px 4px rgba(15,23,42,0.08)" : "none" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={centerBox}>
          <div style={spinner} />
        </div>
      ) : tab === "comments" ? (
        comments.length === 0 ? (
          <div style={centerBox}>
            <p style={{ color: "var(--c-text-5)", fontSize: 15, fontWeight: 600 }}>작성한 댓글이 없어요</p>
          </div>
        ) : (
          <div style={{ padding: "8px 20px 28px" }}>
            <div style={card}>
              {comments.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/community/${c.postId}`)}
                  className="press"
                  style={{ ...itemRow, borderBottom: i < comments.length - 1 ? "1px solid var(--c-bg-muted)" : "none" }}
                >
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-5)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {c.groupName && <span style={{ color: "var(--c-brand-b)", marginRight: 6 }}>{c.groupName}</span>}
                    {c.postActive ? c.postTitle : "삭제된 글"}
                  </p>
                  <p style={{ fontSize: 14.5, color: "var(--c-text-2)", margin: "6px 0 0", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                    {c.content}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-5)", margin: "8px 0 0", fontWeight: 600 }}>
                    {new Date(c.createdAt).toLocaleDateString("ko-KR")} · 좋아요 {c.likeCount}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )
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

const segWrap = {
  display: "flex",
  gap: 4,
  margin: "6px 20px 4px",
  padding: 4,
  borderRadius: 12,
  background: "var(--c-bg-muted)",
} as const;

const segBtn = {
  flex: 1,
  height: 36,
  border: "none",
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.15s ease, color 0.15s ease",
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
