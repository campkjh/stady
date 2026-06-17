"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CommunityTag {
  id: string;
  name: string;
  slug: string;
}

interface CommunityComment {
  id: string;
  parentId: string | null;
  nickname: string;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: CommunityComment[];
}

interface CommunityPostDetail {
  id: string;
  nickname: string;
  groupName: string;
  title: string;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  imageUrls: string[];
  tags: CommunityTag[];
}

interface CommunityPostDetailClientProps {
  postId: string;
}

export default function CommunityPostDetailClient({ postId }: CommunityPostDetailClientProps) {
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
      setPost(data.post);
      setComments(data.comments || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;

    setCommentPosting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글을 저장하지 못했습니다.");
      setComment("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setCommentPosting(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>, parentId: string) {
    event.preventDefault();
    const content = replyContent.trim();
    if (!content) return;

    setReplyPosting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "답글을 저장하지 못했습니다.");
      setReplyTargetId("");
      setReplyContent("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "답글을 저장하지 못했습니다.");
    } finally {
      setReplyPosting(false);
    }
  }

  async function togglePostLike() {
    if (!post) return;
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "공감을 처리하지 못했습니다.");
      setPost({ ...post, likedByMe: data.liked, likeCount: data.likeCount });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공감을 처리하지 못했습니다.");
    }
  }

  async function toggleCommentLike(commentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글 공감을 처리하지 못했습니다.");
      setComments((current) =>
        updateComment(current, commentId, (item) => ({
          ...item,
          likedByMe: data.liked,
          likeCount: data.likeCount,
        }))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 공감을 처리하지 못했습니다.");
    }
  }

  return (
    <main className="community-detail-page">
      <div className="community-detail-shell">
        <header className="community-detail-topbar">
          <button
            type="button"
            onClick={() => router.push("/community")}
            aria-label="커뮤니티 목록으로 이동"
            className="community-detail-icon-button"
            style={iconButtonStyle}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="community-detail-eyebrow">STADY</p>
            <h1 style={{ margin: 0, color: "#111827", fontSize: 24, fontWeight: 900 }}>커뮤니티</h1>
          </div>
        </header>

        {message && (
          <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700 }}>
            {message}
          </div>
        )}

        {loading && !post ? (
          <div style={panelStyle}>
            <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>게시글을 불러오는 중...</p>
          </div>
        ) : post ? (
          <>
            <article className="community-detail-panel community-post-detail-card" style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ borderRadius: 999, border: "1px solid #EEF0F3", background: "transparent", color: "#374151", padding: "7px 10px", fontSize: 13, fontWeight: 900 }}>{post.groupName}</span>
                <span style={{ color: "#8A909C", fontSize: 12 }}>{new Date(post.createdAt).toLocaleString("ko-KR")}</span>
              </div>
              <h2 style={{ margin: "10px 0 0", color: "#111827", fontSize: 24, lineHeight: 1.35, fontWeight: 900 }}>{post.title}</h2>
              <p style={{ margin: "8px 0 0", color: "#8A909C", fontSize: 13, fontWeight: 700 }}>{post.nickname}</p>
              <p style={{ margin: "16px 0", color: "#374151", fontSize: 16, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.content}</p>
              {post.imageUrls.length > 0 && (
                <div className="community-detail-image-list">
                  {post.imageUrls.map((imageUrl, index) => (
                    <img key={imageUrl} src={imageUrl} alt={`${post.title} 이미지 ${index + 1}`} />
                  ))}
                </div>
              )}
              {post.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {post.tags.map((tag) => (
                    <span key={tag.id} style={tagBadgeStyle}>
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="button" className="community-action-button" onClick={togglePostLike} style={actionButtonStyle(post.likedByMe)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={post.likedByMe ? "currentColor" : "none"} aria-hidden="true">
                    <path d="M12 20.5C8.2 17.1 5 14.25 5 10.85C5 8.65 6.7 7 8.8 7C10 7 11.15 7.55 12 8.45C12.85 7.55 14 7 15.2 7C17.3 7 19 8.65 19 10.85C19 14.25 15.8 17.1 12 20.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                  공감 {post.likeCount}
                </button>
                <span style={{ color: "#6B7280", fontSize: 13, fontWeight: 800 }}>댓글 {post.commentCount}</span>
              </div>
            </article>

            <section className="community-detail-panel" style={panelStyle}>
              <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 900 }}>댓글</h2>
              <form onSubmit={submitComment} style={{ display: "grid", gap: 10 }}>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="댓글을 입력해주세요"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
                />
                <button type="submit" className="community-primary-button" disabled={commentPosting || !comment.trim()} style={primaryButtonStyle}>
                  {commentPosting ? "등록 중..." : "댓글 등록"}
                </button>
              </form>

              <div style={{ display: "grid", gap: 10 }}>
                {comments.length === 0 ? (
                  <p style={{ margin: 0, color: "#8A909C", fontSize: 14 }}>첫 댓글을 남겨보세요.</p>
                ) : (
                  comments.map((item) => (
                    <CommentItem
                      key={item.id}
                      comment={item}
                      replyTargetId={replyTargetId}
                      replyContent={replyContent}
                      replyPosting={replyPosting}
                      onToggleLike={toggleCommentLike}
                      onOpenReply={(id) => {
                        setReplyTargetId((current) => (current === id ? "" : id));
                        setReplyContent("");
                      }}
                      onReplyChange={setReplyContent}
                      onSubmitReply={submitReply}
                    />
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <div style={panelStyle}>
            <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>게시글을 찾을 수 없습니다.</p>
          </div>
        )}
      </div>
      <style>{`
        .community-detail-page {
          min-height: 100vh;
          background: #fff;
          color: #111827;
          padding: 0 16px calc(120px + env(safe-area-inset-bottom, 0px));
        }
        .community-detail-shell {
          max-width: 760px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
          padding-top: calc(76px + env(safe-area-inset-top, 0px));
        }
        .community-detail-topbar {
          position: fixed;
          top: 0;
          left: 50%;
          z-index: 80;
          width: min(100vw, 500px);
          max-width: 500px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          transform: translateX(-50%);
          padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
          background: rgba(255, 255, 255, 0.88);
          border-bottom: 1px solid rgba(229, 231, 235, 0.8);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .community-detail-eyebrow {
          margin: 0 0 2px;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 900;
        }
        .community-detail-panel {
          animation: communityDetailIn 0.22s ease both;
        }
        .community-post-detail-card {
          margin-top: 14px;
        }
        .community-detail-image-list {
          display: grid;
          gap: 8px;
        }
        .community-detail-image-list img {
          display: block;
          width: 100%;
          max-height: 620px;
          object-fit: contain;
          border: 1px solid #eef0f3;
          border-radius: 8px;
          background: #f9fafb;
        }
        .community-detail-icon-button:hover {
          background: #F9FAFB !important;
          border-color: #D1D5DB !important;
          transform: translateX(-1px);
        }
        .community-action-button,
        .community-primary-button,
        .community-reply-button,
        .community-detail-icon-button {
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .community-action-button:hover,
        .community-reply-button:hover {
          border-color: #D1D5DB !important;
          box-shadow: 0 5px 13px rgba(15, 23, 42, 0.06);
        }
        .community-primary-button:hover:not(:disabled) {
          box-shadow: 0 8px 18px rgba(55,135,255,0.24);
        }
        .community-action-button:active,
        .community-primary-button:active,
        .community-reply-button:active,
        .community-detail-icon-button:active {
          transform: scale(0.97);
        }
        @keyframes communityDetailIn {
          from { opacity: 0; transform: translateY(7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 900px) {
          .community-detail-page {
            padding-left: 24px;
            padding-right: 24px;
          }
          .community-detail-topbar {
            padding-left: 24px;
            padding-right: 24px;
          }
        }
      `}</style>
    </main>
  );
}

interface CommentItemProps {
  comment: CommunityComment;
  replyTargetId: string;
  replyContent: string;
  replyPosting: boolean;
  onToggleLike: (id: string) => void;
  onOpenReply: (id: string) => void;
  onReplyChange: (value: string) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>, parentId: string) => void;
}

function CommentItem({
  comment,
  replyTargetId,
  replyContent,
  replyPosting,
  onToggleLike,
  onOpenReply,
  onReplyChange,
  onSubmitReply,
}: CommentItemProps) {
  return (
    <div style={commentBoxStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ color: "#111827", fontSize: 14 }}>{comment.nickname}</strong>
        <span style={{ color: "#9CA3AF", fontSize: 12 }}>{new Date(comment.createdAt).toLocaleString("ko-KR")}</span>
      </div>
      <p style={{ margin: "8px 0 0", color: "#374151", fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{comment.content}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="community-action-button" onClick={() => onToggleLike(comment.id)} style={smallActionButtonStyle(comment.likedByMe)}>
          공감 {comment.likeCount}
        </button>
        <button type="button" className="community-reply-button" onClick={() => onOpenReply(comment.id)} style={smallActionButtonStyle(false)}>
          답글
        </button>
      </div>

      {replyTargetId === comment.id && (
        <form onSubmit={(event) => onSubmitReply(event, comment.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <textarea
            value={replyContent}
            onChange={(event) => onReplyChange(event.target.value)}
            placeholder="답글을 입력해주세요"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
          />
          <button type="submit" className="community-primary-button" disabled={replyPosting || !replyContent.trim()} style={{ ...primaryButtonStyle, padding: "10px 12px", justifySelf: "end" }}>
            {replyPosting ? "등록 중..." : "답글 등록"}
          </button>
        </form>
      )}

      {comment.replies.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 10, paddingLeft: 12, borderLeft: "2px solid #E5E7EB" }}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replyTargetId={replyTargetId}
              replyContent={replyContent}
              replyPosting={replyPosting}
              onToggleLike={onToggleLike}
              onOpenReply={onOpenReply}
              onReplyChange={onReplyChange}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function updateComment(
  items: CommunityComment[],
  commentId: string,
  updater: (comment: CommunityComment) => CommunityComment
): CommunityComment[] {
  return items.map((item) => {
    if (item.id === commentId) return updater(item);
    return { ...item, replies: updateComment(item.replies, commentId, updater) };
  });
}

const iconButtonStyle = {
  width: 38,
  height: 38,
  border: "1px solid #E5E7EB",
  borderRadius: 999,
  background: "#fff",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

const panelStyle = {
  display: "grid",
  gap: 14,
  borderTop: "1px solid #EEF0F3",
  borderBottom: "1px solid #EEF0F3",
  borderRadius: 0,
  background: "transparent",
  padding: "18px 0",
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "12px 13px",
  color: "#111827",
  background: "#fff",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

const primaryButtonStyle = {
  border: "none",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  padding: "12px 14px",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
} as const;

const tagBadgeStyle = {
  borderRadius: 999,
  background: "transparent",
  border: "1px solid #EEF0F3",
  color: "#4B5563",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
} as const;

function actionButtonStyle(active: boolean) {
  return {
    border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#374151",
    padding: "9px 12px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as const;
}

function smallActionButtonStyle(active: boolean) {
  return {
    border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#4B5563",
    padding: "7px 10px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  } as const;
}

const commentBoxStyle = {
  borderTop: "1px solid #EEF0F3",
  borderRadius: 0,
  background: "transparent",
  padding: "12px 0",
} as const;
