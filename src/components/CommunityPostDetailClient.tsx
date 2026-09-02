"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";
import ReportBlockMenu from "@/components/ReportBlockMenu";
import { clientCache } from "@/lib/clientCache";
import AnswerKingBadge from "@/components/AnswerKingBadge";
import NudgeBubble from "@/components/NudgeBubble";
import BlindNoiseCover from "@/components/BlindNoiseCover";
import { formatRelativeTime, formatExactTime } from "@/lib/relativeTime";
import { uploadCommunityImage, revokeUploadPreview } from "@/lib/communityUpload";

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
  /** 신고·차단 대상 판별용 — API(mapComment)는 예전부터 내려주고 있었다. */
  userId?: string | null;
  nickname: string;
  avatar?: string | null;
  authorTier?: string;
  authorIsAnswerKing?: boolean;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: CommunityComment[];
}

const TIERS = ["iron", "silver", "gold", "emerald", "diamond", "master", "grandmaster", "gongsin"];
// 댓글 정렬(백엔드 CommentSort 키와 일치).
const COMMENT_SORTS = [
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" },
  { key: "popular", label: "인기순" },
  { key: "recommended", label: "추천순" },
] as const;
type CommentSortKey = (typeof COMMENT_SORTS)[number]["key"];
function TierBadge({ tier }: { tier?: string }) {
  if (!tier || !TIERS.includes(tier)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/tier-${tier}.svg`} alt="" width={15} height={15} style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4 }} />
  );
}

// 프로필 사진(카톡)이 있으면 사진, 없으면 닉네임 첫 글자. 애플 로그인은 사진 없음 → 첫 글자.
function MiniAvatar({ nickname, avatar, size = 30 }: { nickname: string; avatar?: string | null; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 999,
        overflow: "hidden",
        background: "var(--c-bg-muted)",
        color: "var(--c-text)",
        fontSize: Math.round(size * 0.44),
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        nickname.slice(0, 1)
      )}
    </span>
  );
}

function QBadge({ answered }: { answered: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={answered ? "/icons/quiz-q-answered.svg" : "/icons/quiz-q-gray.svg"} alt={answered ? "답변완료" : "미답변"} width={20} height={20} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
  );
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
  avatar?: string | null;
  authorTier?: string;
  authorIsAnswerKing?: boolean;
  groupName: string;
  groupSlug?: string;
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
  pinnedCommentId?: string | null;
}

// 이모지 대신 아이콘셋(public/icons/community/*.svg)으로 통일한다.
const REACTIONS: { key: string; icon: string; label: string }[] = [
  { key: "heart", icon: "heart-red", label: "좋아요" },
  { key: "sad", icon: "emoji-cry", label: "슬퍼요" },
  { key: "laugh", icon: "emoji-grin", label: "웃겨요" },
  { key: "smile", icon: "emoji-ok", label: "좋아요" },
  { key: "devil", icon: "emoji-fire", label: "화나요" },
  { key: "skull", icon: "emoji-cold", label: "충격" },
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
  const [revealBlind, setRevealBlind] = useState(false);
  const [voting, setVoting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  // 투표 선택지 편집: id 있으면 기존 항목(표 유지), 없으면 새 항목.
  const [editPoll, setEditPoll] = useState<{ id: string | null; text: string }[]>([]);
  // 이번 편집에서 새로 올린 이미지의 로컬 프리뷰(서버 URL → objectURL).
  // 기존 이미지는 File 이 없으므로 여기 없고, 그때는 서버 URL 로 폴백한다.
  const [editPreviews, setEditPreviews] = useState<Record<string, string>>({});
  const [uploadingEdit, setUploadingEdit] = useState(false);
  // 언마운트 시 남은 프리뷰 objectURL 해제(WebView 메모리 누수 방지).
  const editPreviewsRef = useRef<Record<string, string>>({});
  editPreviewsRef.current = editPreviews;
  useEffect(
    () => () => {
      Object.values(editPreviewsRef.current).forEach(revokeUploadPreview);
    },
    []
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // 관리자 댓글 관리(수정/삭제)
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editCommentContent, setEditCommentContent] = useState("");
  const [commentActionBusy, setCommentActionBusy] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const [commentSort, setCommentSort] = useState<CommentSortKey>("popular");

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

  // 정렬만 바꿀 땐 댓글만 다시 받아 화면 전체 로딩 없이 갱신(조회수도 안 올림).
  async function changeCommentSort(s: CommentSortKey) {
    setCommentSort(s);
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}?sort=${s}`);
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch {
      /* 실패해도 기존 목록 유지 */
    }
  }

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
    setEditPoll(
      post.type === "poll" && post.poll
        ? post.poll.options.map((o) => ({ id: o.id, text: o.text }))
        : []
    );
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
      const previews: Record<string, string> = {};
      for (const file of files) {
        if (!isImageFile(file)) throw new Error("이미지 파일만 업로드할 수 있습니다.");
        if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하만 업로드할 수 있습니다.");
        // 축소 → 업로드. 프리뷰는 로컬 파일로 그려 방금 올린 이미지를 되받지 않는다.
        const uploaded = await uploadCommunityImage(file);
        next.push(uploaded.url);
        previews[uploaded.url] = uploaded.previewUrl;
      }
      setEditImages((cur) => [...cur, ...next]);
      setEditPreviews((cur) => ({ ...cur, ...previews }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingEdit(false);
    }
  }

  function removeEditImage(url: string) {
    setEditImages((cur) => cur.filter((u) => u !== url));
    setEditPreviews((cur) => {
      if (!cur[url]) return cur;
      revokeUploadPreview(cur[url]);
      const next = { ...cur };
      delete next[url];
      return next;
    });
  }

  async function saveEdit() {
    if (!post) return;
    const t = editTitle.trim();
    const c = editContent.trim();
    if (!t || !c) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    const isPoll = post.type === "poll";
    const trimmedPoll = editPoll
      .map((o) => ({ id: o.id, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);
    if (isPoll && trimmedPoll.length < 2) {
      setMessage("투표 선택지는 2개 이상 입력해주세요.");
      return;
    }
    setActionBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          content: c,
          imageUrls: editImages,
          ...(isPoll ? { pollOptions: trimmedPoll } : {}),
        }),
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
      // 삭제된 글이 목록에서 사라지도록 캐시 무효화.
      clientCache.clearPrefix("community-");
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

  // 관리자: 댓글 수정 저장
  async function submitCommentEdit(commentId: string) {
    const content = editCommentContent.trim();
    if (!content || commentActionBusy) return;
    setCommentActionBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/community-comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "댓글을 수정하지 못했습니다.");
      setEditingCommentId("");
      setEditCommentContent("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 수정하지 못했습니다.");
    } finally {
      setCommentActionBusy(false);
    }
  }

  // 글쓴이(또는 관리자)가 댓글을 상단 고정 / 해제. 글당 1개만 고정된다.
  async function togglePinComment(commentId: string) {
    if (!post || pinBusy) return;
    const next = post.pinnedCommentId === commentId ? null : commentId;
    setPinBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commentId: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글 고정을 처리하지 못했습니다.");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 고정을 처리하지 못했습니다.");
    } finally {
      setPinBusy(false);
    }
  }

  // 관리자: 댓글 삭제(대댓글 포함 영구 삭제)
  async function doDeleteComment() {
    if (!deleteCommentId || commentActionBusy) return;
    setCommentActionBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/community-comments/${encodeURIComponent(deleteCommentId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "댓글을 삭제하지 못했습니다.");
      setDeleteCommentId("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 삭제하지 못했습니다.");
    } finally {
      setCommentActionBusy(false);
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
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* 헤더엔 'STADY / 커뮤니티' 대신 지금 보고 있는 글 제목을 둔다 — 스크롤을 내려도
              무슨 글인지 알 수 있다. 제목이 길면 한 줄로 줄인다. */}
          <h1 className="community-detail-title">
            {post?.title ?? (loading ? "" : "커뮤니티")}
          </h1>
        </header>

        {message && (
          <div style={{ border: "1px solid var(--c-brand-line-9)", background: "var(--c-brand-soft-4)", color: "var(--c-brand-deep-2)", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500 }}>
            {message}
          </div>
        )}

        {loading && !post ? (
          <div style={panelStyle}>
            <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14 }}>게시글을 불러오는 중...</p>
          </div>
        ) : post ? (
          <>
            <article className="community-detail-panel community-post-detail-card" style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ borderRadius: 999, border: "1px solid var(--c-bg-muted-6)", background: "transparent", color: "var(--c-text-2c)", padding: "7px 10px", fontSize: 13, fontWeight: 700 }}>{post.groupName}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--c-text-4)", fontSize: 12 }} title={formatExactTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</span>
                  <ReportBlockMenu
                    targetType="post"
                    postId={post.id}
                    targetUserId={post.userId}
                    targetNickname={post.nickname}
                    currentUserId={currentUserId}
                    // 차단하면 이 글 자체가 안 보이는 게 맞으므로 목록으로 되돌린다.
                    onBlocked={() => router.push("/community")}
                    variant="dots"
                  />
                </span>
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
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2c)" }}>이미지</span>
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
                          <div key={url} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--c-bg-muted-6)", background: "var(--c-bg-soft)" }}>
                            <img
                              src={editPreviews[url] ?? url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
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
                  {post.type === "poll" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2c)" }}>투표 선택지</span>
                        {editPoll.length < 4 && (
                          <button
                            type="button"
                            onClick={() => setEditPoll((cur) => [...cur, { id: null, text: "" }])}
                            style={ownerBtnStyle(false)}
                          >
                            선택지 추가
                          </button>
                        )}
                      </div>
                      {editPoll.map((opt, index) => (
                        <div key={opt.id ?? `new-${index}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            value={opt.text}
                            onChange={(e) =>
                              setEditPoll((cur) => cur.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))
                            }
                            placeholder={`선택지 ${index + 1}`}
                            maxLength={80}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          {editPoll.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setEditPoll((cur) => cur.filter((_, i) => i !== index))}
                              aria-label="선택지 삭제"
                              style={{
                                flexShrink: 0,
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                border: "1px solid var(--c-border)",
                                background: "var(--c-bg)",
                                color: "var(--c-text-3)",
                                cursor: "pointer",
                                fontSize: 20,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <span style={{ fontSize: 12, color: "var(--c-text-4)", fontWeight: 500 }}>
                        선택지를 삭제하면 그 선택지에 담긴 표도 함께 사라집니다.
                      </span>
                    </div>
                  )}
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
                  <h2 style={{ margin: "10px 0 0", color: "var(--c-text)", fontSize: 24, lineHeight: 1.35, fontWeight: 700 }}>
                    {post.groupSlug === "qna" && <QBadge answered={post.commentCount > 0} />}
                    {post.title}
                  </h2>
                  <div style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <MiniAvatar nickname={post.nickname} avatar={post.avatar} size={34} />
                    <p style={{ margin: 0, color: "var(--c-text-4)", fontSize: 13, fontWeight: 500 }}>{post.nickname}<TierBadge tier={post.authorTier} /><AnswerKingBadge show={post.authorIsAnswerKing} /> · 조회 {post.viewCount ?? 0}</p>
                  </div>
                  <p style={{ margin: "16px 0", color: "var(--c-text-2c)", fontSize: 16, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.content}</p>
                  {(() => {
                    const isOwner = !!post.userId && currentUserId === post.userId;
                    if (!isOwner && !isAdmin) return null;
                    // 관리자가 남의 글을 강제 편집/삭제하는 경우엔 라벨과 배지로 구분.
                    const moderating = isAdmin && !isOwner;
                    return (
                      <div style={{ display: "flex", gap: 8, margin: "0 0 4px", alignItems: "center" }}>
                        {moderating && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-danger-deep)", background: "var(--c-danger-soft-3)", borderRadius: 999, padding: "4px 10px" }}>
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
                      // 첫 장은 바로 보이므로 즉시, 나머지는 스크롤해서 닿을 때만 받는다.
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      style={
                        post.isBlinded && !revealBlind
                          ? { filter: "blur(24px)", transform: "scale(1.04)" }
                          : undefined
                      }
                    />
                  ))}
                  {post.isBlinded && !revealBlind && (
                    <BlindNoiseCover onReveal={() => setRevealBlind(true)} />
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
                            background: mine ? "var(--c-brand-line-2)" : "var(--c-bg-muted)",
                            borderRadius: 10,
                            transition: "width 0.3s ease",
                          }}
                        />
                        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "var(--c-text)" }}>
                          {mine && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src="/icons/community/check.svg" alt="" width={16} height={16} style={{ display: "block", flexShrink: 0 }} />
                          )}
                          {opt.text}
                        </span>
                        <span style={{ position: "relative", fontWeight: 600, color: "var(--c-text-3)", fontSize: 13 }}>
                          {pct}% · {opt.votes}표
                        </span>
                      </button>
                    );
                  })}
                  <span style={{ color: "var(--c-text-4)", fontSize: 13 }}>
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
                <NudgeBubble
                  icon="xp-like"
                  text="공감하면 작성자에게 경험치 +2"
                  tailAlign="start"
                  tailInset={18}
                  compact
                  style={{ justifySelf: "start", marginBottom: -4 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}>
                  <button
                    type="button"
                    className="community-action-button"
                    onClick={() => react("heart")}
                    style={actionButtonStyle(!!post.myReaction)}
                  >
                    <ReactionIcon name={post.myReaction ? reactionIcon(post.myReaction) : "heart-grey"} size={18} />
                    {post.myReaction ? reactionLabel(post.myReaction) : "좋아요"} {post.likeCount}
                  </button>
                  <span style={{ color: "var(--c-text-3)", fontSize: 13, fontWeight: 600 }}>댓글 {post.commentCount}</span>
                </div>
                {post.likeCount > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {REACTIONS.filter((r) => (post.reactionCounts[r.key] || 0) > 0).map((r) => (
                      <span key={r.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--c-text-3)", fontWeight: 500 }}>
                        <ReactionIcon name={r.icon} size={15} /> {post.reactionCounts[r.key]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <section className="community-detail-panel" style={panelStyle}>
              <h2 style={{ margin: 0, color: "var(--c-text)", fontSize: 18, fontWeight: 700 }}>댓글</h2>
              <NudgeBubble
                icon="xp-comment"
                text="댓글 남기고 경험치 쌓기"
                xp={3}
                tailAlign="start"
                tailInset={20}
                style={{ justifySelf: "start", margin: "-6px 0 -8px" }}
              />
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

              {comments.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COMMENT_SORTS.map((s) => {
                    const on = commentSort === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => changeCommentSort(s.key)}
                        aria-selected={on}
                        style={{
                          border: `1px solid ${on ? "var(--c-inverse)" : "var(--c-border)"}`,
                          background: on ? "var(--c-inverse)" : "transparent",
                          color: on ? "#fff" : "var(--c-text-3)",
                          borderRadius: 999,
                          padding: "6px 12px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {comments.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--c-text-4)", fontSize: 14 }}>첫 댓글을 남겨보세요.</p>
                ) : (
                  comments.map((item) => (
                    <CommentItem
                      key={item.id}
                      comment={item}
                      currentUserId={currentUserId}
                      onBlocked={() => loadDetail()}
                      replyTargetId={replyTargetId}
                      replyContent={replyContent}
                      replyPosting={replyPosting}
                      isAdmin={isAdmin}
                      canPin={!!post && (isAdmin || (!!currentUserId && post.userId === currentUserId))}
                      isPinned={post?.pinnedCommentId === item.id}
                      pinBusy={pinBusy}
                      onTogglePin={togglePinComment}
                      editingCommentId={editingCommentId}
                      editCommentContent={editCommentContent}
                      commentActionBusy={commentActionBusy}
                      onStartEdit={(c) => {
                        setEditingCommentId(c.id);
                        setEditCommentContent(c.content);
                      }}
                      onEditChange={setEditCommentContent}
                      onCancelEdit={() => {
                        setEditingCommentId("");
                        setEditCommentContent("");
                      }}
                      onSubmitEdit={submitCommentEdit}
                      onDelete={(id) => setDeleteCommentId(id)}
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
            <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14 }}>게시글을 찾을 수 없습니다.</p>
          </div>
        )}
      </div>
      <style>{`
        .community-detail-page {
          min-height: 100vh;
          background: var(--c-bg);
          color: var(--c-text);
          padding: 0 16px calc(120px + env(safe-area-inset-bottom, 0px));
        }
        .community-detail-shell {
          max-width: 760px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
          padding-top: calc(62px + env(safe-area-inset-top, 0px));
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
          background: var(--c-bg-a88);
          border-bottom: 1px solid rgba(229, 231, 235, 0.8);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .community-detail-icon-button {
          flex-shrink: 0;
          transition: background-color 0.14s ease, color 0.14s ease;
        }
        .community-detail-icon-button:active {
          background: var(--c-bg-muted-20) !important;
          color: var(--c-text-2) !important;
        }
        .community-detail-title {
          margin: 0;
          min-width: 0;
          flex: 1;
          color: var(--c-text);
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.3px;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        /* 넓은 화면에서 헤더가 24px 제목 + 두 줄 구성이라 지나치게 두꺼웠다.
           한 줄 제목으로 바꾸면서 높이도 함께 낮춘다. */
        @media (min-width: 720px) {
          .community-detail-topbar {
            padding: calc(12px + env(safe-area-inset-top, 0px)) 18px 12px;
          }
          .community-detail-title {
            font-size: 18px;
          }
        }
        .community-detail-panel {
          animation: communityDetailIn 0.22s ease;
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
          border: 1px solid var(--c-bg-muted-6);
          border-radius: 8px;
          background: var(--c-bg-soft);
        }
        .community-detail-icon-button:hover {
          background: var(--c-bg-soft) !important;
          border-color: var(--c-border-strong) !important;
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
          border-color: var(--c-border-strong) !important;
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
            { label: "삭제", bgColor: "var(--c-danger-b)", color: "#fff", onClick: doDelete },
            { label: "취소", bgColor: "var(--c-bg-muted-2)", color: "var(--c-text-2d)", onClick: () => setShowDeleteConfirm(false) },
          ]}
        />
      )}

      {deleteCommentId && (
        <AlertModal
          title={"댓글을 삭제할까요?"}
          subtitle={"대댓글도 함께 삭제되며 되돌릴 수 없어요."}
          onClose={() => setDeleteCommentId("")}
          buttons={[
            { label: "삭제", bgColor: "var(--c-danger-b)", color: "#fff", onClick: doDeleteComment },
            { label: "취소", bgColor: "var(--c-bg-muted-2)", color: "var(--c-text-2d)", onClick: () => setDeleteCommentId("") },
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
  isAdmin: boolean;
  /** 글쓴이(또는 관리자)만 댓글을 고정할 수 있다. 답글은 대상이 아니다. */
  canPin?: boolean;
  isPinned?: boolean;
  pinBusy?: boolean;
  onTogglePin?: (id: string) => void;
  editingCommentId: string;
  editCommentContent: string;
  commentActionBusy: boolean;
  onStartEdit: (comment: CommunityComment) => void;
  onEditChange: (value: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
  onOpenReply: (id: string) => void;
  onReplyChange: (value: string) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>, parentId: string) => void;
  currentUserId: string | null;
  /** 차단 후 댓글 목록을 다시 불러온다. */
  onBlocked: () => void;
}

function CommentItem({
  comment,
  replyTargetId,
  replyContent,
  replyPosting,
  isAdmin,
  canPin = false,
  isPinned = false,
  pinBusy = false,
  onTogglePin,
  editingCommentId,
  editCommentContent,
  commentActionBusy,
  onStartEdit,
  onEditChange,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onToggleLike,
  onOpenReply,
  onReplyChange,
  onSubmitReply,
  currentUserId,
  onBlocked,
}: CommentItemProps) {
  const isEditing = editingCommentId === comment.id;
  return (
    <div style={isPinned ? { ...commentBoxStyle, background: "var(--c-warn-soft)", border: "1px solid var(--c-warn-line)", borderRadius: 14, padding: 14 } : commentBoxStyle}>
      {isPinned && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/pin-star.svg" alt="" width={15} height={15} style={{ display: "block" }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--c-warn-d)" }}>고정</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <MiniAvatar nickname={comment.nickname} avatar={comment.avatar} size={28} />
          <strong style={{ color: "var(--c-text)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comment.nickname}<TierBadge tier={comment.authorTier} /><AnswerKingBadge show={comment.authorIsAnswerKing} /></strong>
        </span>
        <span style={{ color: "var(--c-text-4c)", fontSize: 12, flexShrink: 0 }} title={formatExactTime(comment.createdAt)}>{formatRelativeTime(comment.createdAt)}</span>
      </div>
      {isEditing ? (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <textarea
            value={editCommentContent}
            onChange={(event) => onEditChange(event.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onCancelEdit} style={{ ...smallActionButtonStyle(false), cursor: "pointer" }}>취소</button>
            <button
              type="button"
              onClick={() => onSubmitEdit(comment.id)}
              disabled={commentActionBusy || !editCommentContent.trim()}
              style={{ ...smallActionButtonStyle(true), cursor: "pointer", opacity: commentActionBusy ? 0.6 : 1 }}
            >
              {commentActionBusy ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: "8px 0 0", color: "var(--c-text-2c)", fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{comment.content}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="community-action-button" onClick={() => onToggleLike(comment.id)} style={smallActionButtonStyle(comment.likedByMe)}>
          공감 {comment.likeCount}
        </button>
        <button type="button" className="community-reply-button" onClick={() => onOpenReply(comment.id)} style={smallActionButtonStyle(false)}>
          답글
        </button>
        <ReportBlockMenu
          targetType="comment"
          commentId={comment.id}
          targetUserId={comment.userId}
          targetNickname={comment.nickname}
          currentUserId={currentUserId}
          onBlocked={onBlocked}
          compact
        />
        {canPin && (
          <button
            type="button"
            onClick={() => onTogglePin?.(comment.id)}
            disabled={pinBusy}
            style={{
              ...smallActionButtonStyle(isPinned),
              display: "inline-flex", alignItems: "center", gap: 4,
              cursor: pinBusy ? "default" : "pointer", opacity: pinBusy ? 0.6 : 1,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/pin-star.svg" alt="" width={14} height={14} style={{ display: "block" }} />
            {isPinned ? "고정 해제" : "고정"}
          </button>
        )}
        {isAdmin && !isEditing && (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ padding: "2px 7px", borderRadius: 999, background: "var(--c-brand-soft-3)", color: "var(--c-brand-deep)", fontSize: 10.5, fontWeight: 800 }}>관리자</span>
            <button type="button" onClick={() => onStartEdit(comment)} style={{ border: "none", background: "none", color: "var(--c-brand)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 2px" }}>
              수정
            </button>
            <button type="button" onClick={() => onDelete(comment.id)} style={{ border: "none", background: "none", color: "var(--c-danger-b)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 2px" }}>
              삭제
            </button>
          </span>
        )}
      </div>

      {replyTargetId === comment.id && (
        <form onSubmit={(event) => onSubmitReply(event, comment.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <NudgeBubble
            icon="xp-comment"
            text="답글도 경험치가 쌓여요"
            xp={3}
            tailAlign="start"
            tailInset={16}
            compact
            style={{ justifySelf: "start", marginBottom: -6 }}
          />
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
        <div style={{ display: "grid", gap: 8, marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--c-border)" }}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onBlocked={onBlocked}
              replyTargetId={replyTargetId}
              replyContent={replyContent}
              replyPosting={replyPosting}
              isAdmin={isAdmin}
              editingCommentId={editingCommentId}
              editCommentContent={editCommentContent}
              commentActionBusy={commentActionBusy}
              onStartEdit={onStartEdit}
              onEditChange={onEditChange}
              onCancelEdit={onCancelEdit}
              onSubmitEdit={onSubmitEdit}
              onDelete={onDelete}
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

// 뒤로가기. 흰 면 + 테두리 원은 헤더에서 버튼만 도드라져 투박했다 —
// 테두리를 없애고 은은한 회색 면에 회색 화살표로 낮춘다(누르면 한 톤 진해진다).
const iconButtonStyle = {
  width: 34,
  height: 34,
  border: "none",
  borderRadius: 999,
  background: "var(--c-bg-muted-3)",
  color: "var(--c-text-3c)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

const panelStyle = {
  display: "grid",
  gap: 14,
  // borderTop 제거: 위 요소(헤더/글 영역)의 border-bottom 과 겹쳐 줄이 2개로 보였다.
  borderBottom: "1px solid var(--c-bg-muted-6)",
  borderRadius: 0,
  background: "transparent",
  padding: "18px 0",
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid var(--c-border-strong)",
  borderRadius: 8,
  padding: "12px 13px",
  color: "var(--c-text)",
  background: "var(--c-bg)",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

const primaryButtonStyle = {
  border: "none",
  borderRadius: 999,
  background: "var(--c-inverse)",
  color: "#fff",
  padding: "12px 14px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const tagBadgeStyle = {
  borderRadius: 999,
  background: "transparent",
  border: "1px solid var(--c-bg-muted-6)",
  color: "var(--c-text-2d)",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 600,
} as const;

function actionButtonStyle(active: boolean) {
  return {
    border: `1px solid ${active ? "var(--c-inverse)" : "var(--c-border)"}`,
    borderRadius: 999,
    background: active ? "var(--c-inverse)" : "var(--c-bg)",
    color: active ? "#fff" : "var(--c-text-2c)",
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
    border: primary ? "none" : "1px solid var(--c-border)",
    borderRadius: 999,
    background: primary ? "var(--c-inverse)" : "var(--c-bg)",
    color: primary ? "#fff" : "var(--c-text-2d)",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

const ownerDangerStyle = {
  border: "1px solid var(--c-danger-line)",
  borderRadius: 999,
  background: "var(--c-danger-soft)",
  color: "var(--c-danger-c)",
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const;

// 리액션 키 → 아이콘 파일명(없으면 기본 하트).
function reactionIcon(key: string) {
  return REACTIONS.find((r) => r.key === key)?.icon || "heart-red";
}

function reactionLabel(key: string) {
  return REACTIONS.find((r) => r.key === key)?.label || "좋아요";
}

// 리액션 아이콘 이미지(이모지 대체).
function ReactionIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/community/${name}.svg`}
      alt=""
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}

function pollOptionStyle(mine: boolean) {
  return {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    border: `1px solid ${mine ? "var(--c-brand)" : "var(--c-border)"}`,
    borderRadius: 10,
    background: "var(--c-bg)",
    padding: "12px 14px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  } as const;
}

function smallActionButtonStyle(active: boolean) {
  return {
    border: `1px solid ${active ? "var(--c-inverse)" : "var(--c-border)"}`,
    borderRadius: 999,
    background: active ? "var(--c-inverse)" : "var(--c-bg)",
    color: active ? "#fff" : "var(--c-text-2d)",
    padding: "7px 10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

const commentBoxStyle = {
  borderTop: "1px solid var(--c-bg-muted-6)",
  borderRadius: 0,
  background: "transparent",
  padding: "12px 0",
} as const;
