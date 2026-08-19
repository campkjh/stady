"use client";

import { useEffect, useRef, useState } from "react";
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

  // 공지 페이지는 공지 개수만큼(현재 15개) 이 컴포넌트를 한 번에 마운트한다.
  // 예전엔 전부 마운트 즉시 cache:"no-store" 로 상세 API 를 때려서, 접혀 있어 보이지도 않는
  // 공지 15건분의 서버리스 호출이 진입할 때마다 나갔다. 아코디언이 접힌 동안에는
  // max-height:0 + overflow:hidden 이라 이 노드가 화면과 교차하지 않으므로,
  // 실제로 펼쳐졌을 때 한 번만 부른다(아코디언의 높이 측정 로직은 건드리지 않는다).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver !== "function") {
      // 관측을 못 하면 예전처럼 즉시 불러온다(기능 우선).
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
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
  }, [postId, visible]);

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
    <div ref={rootRef} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-bg-muted)" }}>
      <button
        type="button"
        onClick={toggleLike}
        className="press"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          height: 34, padding: "0 13px", borderRadius: 999, cursor: "pointer",
          border: `1px solid ${liked ? "var(--c-danger-line-4)" : "var(--c-border)"}`,
          background: liked ? "var(--c-danger-soft-7)" : "var(--c-bg)",
          color: liked ? "var(--c-danger-d)" : "var(--c-text-3)",
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
          border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-3)",
          fontSize: 13, fontWeight: 700,
        }}
      >
        💬 댓글 {commentCount}
      </button>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-4c)", fontWeight: 600 }}>
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
