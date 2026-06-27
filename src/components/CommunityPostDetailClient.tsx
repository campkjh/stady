"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";

// Android WebView often returns gallery files with an empty/generic MIME type,
// so fall back to the file extension (same logic as the write form).
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i;
function isImageFile(file: File) {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type.startsWith("image/");
  }
  return IMAGE_EXT_RE.test(file.name || "");
}

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

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface CommunityPoll {
  options: PollOption[];
  totalVotes: number;
  myOptionId: string | null;
}

interface CommunityPostDetail {
  id: string;
  userId: string | null;
  nickname: string;
  groupName: string;
  title: string;
  content: string;
  type: string;
  isBlinded: boolean;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  reactionCounts: Record<string, number>;
  myReaction: string | null;
  poll: CommunityPoll | null;
  imageUrls: string[];
  tags: CommunityTag[];
}

const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "heart", emoji: "❤️", label: "공감" },
  { key: "sad", emoji: "🥺", label: "슬퍼요" },
  { key: "laugh", emoji: "🤣", label: "웃겨요" },
  { key: "smile", emoji: "😄", label: "좋아요" },
  { key: "devil", emoji: "👿", label: "화나요" },
  { key: "skull", emoji: "☠️", label: "충격" },
];

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
  const [showReactions, setShowReactions] = useState(false);
  const [revealBlind, setRevealBlind] = useState(false);
  const [voting, setVoting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadDetail = useCallback(async (track = false) => {
    setLoading(true);
    try {
      // track=true 일 때만 조회수 +1 (최초 진입). 댓글/좋아요 후 재조회는 증가 안 함.
      const url = `/api/community/posts/${encodeURIComponent(postId)}${track ? "?track=1" : ""}`;
      const response = await fetch(url);
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
    loadDetail(true);
  }, [loadDetail]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCurrentUserId(d?.user?.id ?? null);
        setIsAdmin(d?.user?.role === "admin");
      })
      .catch(() => {
        setCurrentUserId(null);
        setIsAdmin(false);
      });
  }, []);

  function startEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditImages([...post.imageUrls]);
    setEditing(true);
  }

  async function uploadEditImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (editImages.length + files.length > 5) {
      setMessage("이미지는 최대 5장까지 올릴 수 있습니다.");
      return;
    }
    setUploadingEdit(true);
    setMessage("");
    try {
      const next: string[] = [];
      for (const file of files) {
        if (!isImageFile(file)) throw new Error("이미지 파일만 업로드할 수 있습니다.");
        if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하만 업로드할 수 있습니다.");
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/community/uploads", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "이미지 업로드에 실패했습니다.");
        next.push(data.url);
      }
      setEditImages((cur) => [...cur, ...next]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingEdit(false);
    }
  }

  function removeEditImage(url: string) {
    setEditImages((cur) => cur.filter((u) => u !== url));
  }

  async function saveEdit() {
    if (!post) return;
    const t = editTitle.trim();
    const c = editContent.trim();
    if (!t || !c) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    setActionBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content: c, imageUrls: editImages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "수정에 실패했습니다.");
      setEditing(false);
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수정에 실패했습니다.");
    } finally {
      setActionBusy(false);
    }
  }

  async function doDelete() {
    if (!post) return;
    setShowDeleteConfirm(false);
    setActionBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      router.push("/community");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      setActionBusy(false);
    }
  }

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

  async function react(type: string) {
    if (!post) return;
    setShowReactions(false);
    setMessage("");
    const nextType = post.myReaction === type ? null : type;
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "공감을 처리하지 못했습니다.");
      setPost({
        ...post,
        myReaction: data.myReaction ?? null,
        reactionCounts: data.counts || {},
        likeCount: data.total ?? 0,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공감을 처리하지 못했습니다.");
    }
  }

  async function votePoll(optionId: string) {
    if (!post || voting) return;
    setVoting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "투표를 처리하지 못했습니다.");
      setPost({ ...post, poll: data.poll });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "투표를 처리하지 못했습니다.");
    } finally {
      setVoting(false);
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
            <h1 style={{ margin: 0, color: "#111827", fontSize: 24, fontWeight: 700 }}>커뮤니티</h1>
          </div>
        </header>

        {message && (
          <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500 }}>
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
                <span style={{ borderRadius: 999, border: "1px solid #EEF0F3", background: "transparent", color: "#374151", padding: "7px 10px", fontSize: 13, fontWeight: 700 }}>{post.groupName}</span>
                <span style={{ color: "#8A909C", fontSize: 12 }}>{new Date(post.createdAt).toLocaleString("ko-KR")}</span>
              </div>
              {editing ? (
                <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
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
                    rows={6}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>이미지</span>
                      <label style={{ ...ownerBtnStyle(false), position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center" }}>
                        {uploadingEdit ? "업로드 중..." : "이미지 추가"}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={uploadEditImages}
                          disabled={uploadingEdit || editImages.length >= 5}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        />
                      </label>
                    </div>
                    {editImages.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {editImages.map((url) => (
                          <div key={url} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid #EEF0F3", background: "#F9FAFB" }}>
                            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            <button
                              type="button"
                              onClick={() => removeEditImage(url)}
                              aria-label="이미지 삭제"
                              style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(17,24,39,0.78)", color: "#fff", fontSize: 16, lineHeight: "26px", cursor: "pointer" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={saveEdit} disabled={actionBusy || uploadingEdit} style={ownerBtnStyle(true)}>
                      저장
                    </button>
                    <button type="button" onClick={() => setEditing(false)} disabled={actionBusy} style={ownerBtnStyle(false)}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 style={{ margin: "10px 0 0", color: "#111827", fontSize: 24, lineHeight: 1.35, fontWeight: 700 }}>{post.title}</h2>
                  <p style={{ margin: "8px 0 0", color: "#8A909C", fontSize: 13, fontWeight: 500 }}>{post.nickname} · 조회 {post.viewCount ?? 0}</p>
                  <p style={{ margin: "16px 0", color: "#374151", fontSize: 16, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.content}</p>
                  {(() => {
                    const isOwner = !!post.userId && currentUserId === post.userId;
                    if (!isOwner && !isAdmin) return null;
                    // 관리자가 남의 글을 강제 편집/삭제하는 경우엔 라벨과 배지로 구분.
                    const moderating = isAdmin && !isOwner;
                    return (
                      <div style={{ display: "flex", gap: 8, margin: "0 0 4px", alignItems: "center" }}>
                        {moderating && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C", background: "#FEE2E2", borderRadius: 999, padding: "4px 10px" }}>
                            관리자
                          </span>
                        )}
                        <button type="button" onClick={startEdit} disabled={actionBusy} style={ownerBtnStyle(false)}>
                          {moderating ? "강제 편집" : "편집"}
                        </button>
                        <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={actionBusy} style={ownerDangerStyle}>
                          {moderating ? "강제 삭제" : "삭제"}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
              {!editing && post.imageUrls.length > 0 && (
                <div className="community-detail-image-list" style={{ position: "relative" }}>
                  {post.imageUrls.map((imageUrl, index) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt={`${post.title} 이미지 ${index + 1}`}
                      style={
                        post.isBlinded && !revealBlind
                          ? { filter: "blur(24px)", transform: "scale(1.04)" }
                          : undefined
                      }
                    />
                  ))}
                  {post.isBlinded && !revealBlind && (
                    <button type="button" onClick={() => setRevealBlind(true)} style={blindOverlayStyle}>
                      <span style={{ fontSize: 24 }}>🙈</span>
                      터치하여 보기
                    </button>
                  )}
                </div>
              )}

              {post.poll && (
                <div style={{ display: "grid", gap: 8 }}>
                  {post.poll.options.map((opt) => {
                    const total = post.poll!.totalVotes;
                    const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    const mine = post.poll!.myOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={voting}
                        onClick={() => votePoll(opt.id)}
                        style={pollOptionStyle(mine)}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: mine ? "#DBEAFE" : "#F3F4F6",
                            borderRadius: 10,
                            transition: "width 0.3s ease",
                          }}
                        />
                        <span style={{ position: "relative", fontWeight: 600, color: "#111827" }}>
                          {mine ? "✓ " : ""}
                          {opt.text}
                        </span>
                        <span style={{ position: "relative", fontWeight: 600, color: "#6B7280", fontSize: 13 }}>
                          {pct}% · {opt.votes}표
                        </span>
                      </button>
                    );
                  })}
                  <span style={{ color: "#8A909C", fontSize: 13 }}>
                    총 {post.poll.totalVotes}표
                    {post.poll.myOptionId ? " · 투표 완료 (다시 누르면 변경)" : " · 항목을 눌러 투표하세요"}
                  </span>
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

              <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}>
                  <button
                    type="button"
                    className="community-action-button"
                    onClick={() => setShowReactions((v) => !v)}
                    style={actionButtonStyle(!!post.myReaction)}
                  >
                    <span style={{ fontSize: 17 }}>{post.myReaction ? reactionEmoji(post.myReaction) : "🙂"}</span>
                    {post.myReaction ? reactionLabel(post.myReaction) : "공감"} {post.likeCount}
                  </button>
                  <span style={{ color: "#6B7280", fontSize: 13, fontWeight: 600 }}>댓글 {post.commentCount}</span>
                  {showReactions && (
                    <div style={reactionPickerStyle}>
                      {REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => react(r.key)}
                          title={r.label}
                          style={reactionPickStyle(post.myReaction === r.key)}
                        >
                          <span style={{ fontSize: 22 }}>{r.emoji}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {post.likeCount > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {REACTIONS.filter((r) => (post.reactionCounts[r.key] || 0) > 0).map((r) => (
                      <span key={r.key} style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                        {r.emoji} {post.reactionCounts[r.key]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <section className="community-detail-panel" style={panelStyle}>
              <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 700 }}>댓글</h2>
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
          width: min(100vw, 720px);
          max-width: 720px;
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
          font-weight: 700;
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
        .community-primary-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

      {showDeleteConfirm && (
        <AlertModal
          title={"게시글을 삭제할까요?"}
          subtitle={"삭제하면 되돌릴 수 없어요."}
          onClose={() => setShowDeleteConfirm(false)}
          buttons={[
            { label: "삭제", bgColor: "#E85D5D", color: "#fff", onClick: doDelete },
            { label: "취소", bgColor: "#F2F4F6", color: "#4B5563", onClick: () => setShowDeleteConfirm(false) },
          ]}
        />
      )}
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
  fontWeight: 700,
  cursor: "pointer",
} as const;

const tagBadgeStyle = {
  borderRadius: 999,
  background: "transparent",
  border: "1px solid #EEF0F3",
  color: "#4B5563",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 600,
} as const;

function actionButtonStyle(active: boolean) {
  return {
    border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#374151",
    padding: "9px 12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as const;
}

function ownerBtnStyle(primary: boolean) {
  return {
    border: primary ? "none" : "1px solid #E5E7EB",
    borderRadius: 999,
    background: primary ? "#111827" : "#fff",
    color: primary ? "#fff" : "#4B5563",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

const ownerDangerStyle = {
  border: "1px solid #FECACA",
  borderRadius: 999,
  background: "#FEF2F2",
  color: "#DC2626",
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const;

function reactionEmoji(key: string) {
  return REACTIONS.find((r) => r.key === key)?.emoji || "🙂";
}

function reactionLabel(key: string) {
  return REACTIONS.find((r) => r.key === key)?.label || "공감";
}

const blindOverlayStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "none",
  borderRadius: 8,
  background: "rgba(17, 24, 39, 0.32)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
} as const;

function pollOptionStyle(mine: boolean) {
  return {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    border: `1px solid ${mine ? "#3787FF" : "#E5E7EB"}`,
    borderRadius: 10,
    background: "#fff",
    padding: "12px 14px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  } as const;
}

const reactionPickerStyle = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  left: 0,
  zIndex: 20,
  display: "flex",
  gap: 4,
  padding: 6,
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #E5E7EB",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
} as const;

function reactionPickStyle(active: boolean) {
  return {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 999,
    background: active ? "#EFF6FF" : "transparent",
    cursor: "pointer",
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
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

const commentBoxStyle = {
  borderTop: "1px solid #EEF0F3",
  borderRadius: 0,
  background: "transparent",
  padding: "12px 0",
} as const;
