"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 공지 본문 하단의 공감/댓글 영역. 공지는 커뮤니티 '공지' 게시판에 미러링되어 있어,
// 실제 공감·댓글은 그 글(postId)에 달린다. 여기선 공감 토글과 댓글 진입만 제공.
export default function NoticeReactions({ postId }: { postId: string }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/community/posts/${encodeURIComponent(postId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.post) return;
        setLikeCount(Number(d.post.reaction_counts?.total ?? d.post.like_count ?? 0));
        setLiked(!!d.post.my_reaction);
        setCommentCount(countComments(d.comments || []));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [postId]);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    // 낙관적 업데이트(실패 시 롤백).
    const prev = { liked, likeCount };
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401) {
        setLiked(prev.liked);
        setLikeCount(prev.likeCount);
        setNeedLogin(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (typeof data.total === "number") setLikeCount(data.total);
      else if (typeof data.likeCount === "number") setLikeCount(data.likeCount);
      if (typeof data.liked === "boolean") setLiked(data.liked);
      else if ("myReaction" in data) setLiked(!!data.myReaction);
    } catch {
      setLiked(prev.liked);
      setLikeCount(prev.likeCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
      <button
        type="button"
        onClick={toggleLike}
        className="press"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          height: 34, padding: "0 13px", borderRadius: 999, cursor: "pointer",
          border: `1px solid ${liked ? "#FFC9CF" : "#E5E7EB"}`,
          background: liked ? "#FFF1F2" : "#fff",
          color: liked ? "#E11D48" : "#6B7280",
          fontSize: 13, fontWeight: 700,
        }}
      >
        <span style={{ fontSize: 14 }}>{liked ? "❤️" : "🤍"}</span>
        공감 {likeCount}
      </button>
      <button
        type="button"
        onClick={() => router.push(`/community/${encodeURIComponent(postId)}`)}
        className="press"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          height: 34, padding: "0 13px", borderRadius: 999, cursor: "pointer",
          border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280",
          fontSize: 13, fontWeight: 700,
        }}
      >
        💬 댓글 {commentCount}
      </button>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>
        {needLogin ? "로그인이 필요해요" : "커뮤니티에서 의견을 남겨보세요"}
      </span>
    </div>
  );
}

interface CommentNode {
  replies?: CommentNode[];
}
function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countComments(n.replies || []), 0);
}
