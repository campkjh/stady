"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";
import ReportBlockMenu from "@/components/ReportBlockMenu";
import { clientCache } from "@/lib/clientCache";
import KingBadges from "@/components/KingBadges";
import { TossHeartIcon, TossCommentIcon, TossRepostIcon, TossShareIcon, ReplyArrowIcon, SendUpIcon, formatCount } from "@/components/community/TossIcons";
import { boardTone, boardShortName } from "@/lib/boardTone";
import { renderWithMention } from "@/components/community/mention";
import { PostDetailTour } from "@/components/tours";
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
  authorIsPickKing?: boolean;
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
        // 사진이 없을 때 첫 글자는 진한 글자색이 아니라 연한 쿨그레이로.
        color: "#a3acb8",
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

interface CommunityQuizQuestion {
  id: string;
  text: string;
  myAnswer: boolean | null;
  correctAnswer: boolean | null;
  oCount: number;
  xCount: number;
}

interface CommunityQuiz {
  questions: CommunityQuizQuestion[];
  solvedCount: number;
  correctCount: number;
  participantCount: number;
}

interface CommunityPostDetail {
  id: string;
  userId: string | null;
  nickname: string;
  avatar?: string | null;
  authorTier?: string;
  authorIsAnswerKing?: boolean;
  authorIsPickKing?: boolean;
  repostCount?: number;
  myReposted?: boolean;
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
  quiz: CommunityQuiz | null;
  imageUrls: string[];
  tags: CommunityTag[];
  pinnedCommentId?: string | null;
}

// O / X 는 글자가 아니라 도형으로 그린다(목록 카드와 같은 모양).
function OXMark({ o, size = 22 }: { o: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {o ? (
        <circle cx="12" cy="12" r="7.6" stroke="currentColor" strokeWidth="3.2" />
      ) : (
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <line x1="6.2" y1="6.2" x2="17.8" y2="17.8" />
          <line x1="17.8" y1="6.2" x2="6.2" y2="17.8" />
        </g>
      )}
    </svg>
  );
}

// 이모지 대신 아이콘셋(public/icons/community/*.svg)으로 통일한다.
// emoji = 댓글 입력창 위 줄에서 눌렀을 때 입력칸에 들어가는 글자(아이콘 그림과 같은 모양).
const REACTIONS: { key: string; icon: string; label: string; emoji: string }[] = [
  { key: "heart", icon: "heart-red", label: "좋아요", emoji: "❤️" },
  { key: "sad", icon: "emoji-cry", label: "슬퍼요", emoji: "😢" },
  { key: "laugh", icon: "emoji-grin", label: "웃겨요", emoji: "😁" },
  { key: "smile", icon: "emoji-ok", label: "좋아요", emoji: "👌" },
  { key: "devil", icon: "emoji-fire", label: "화나요", emoji: "🔥" },
  { key: "skull", icon: "emoji-cold", label: "충격", emoji: "🥶" },
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
  // 토스처럼 답글도 아래 고정 입력창 하나로 쓴다: '답글 달기'를 누르면 입력창에 파란 @닉네임이 붙는다.
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);
  const composerRef = useRef<HTMLInputElement | null>(null);
  // 스크롤을 내리면 헤더 아래로 그라데이션이 스르륵 나온다. 맨 위 1px 감시점이 화면에서 벗어났는지로 판단한다
  // (페이지 스크롤이든 넓은 화면 패널 안 스크롤이든 같이 동작).
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [revealBlind, setRevealBlind] = useState(false);
  const [voting, setVoting] = useState(false);
  const [quizBusy, setQuizBusy] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // 어떤 계정으로 쓰는지 보이도록 댓글 입력 위에 내 프로필을 띄운다.
  const [me, setMe] = useState<{ nickname: string; avatar: string | null } | null>(null);
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
        setMe(d?.user ? { nickname: d.user.nickname ?? "나", avatar: d.user.avatar ?? null } : null);
      })
      .catch(() => {
        setCurrentUserId(null);
        setIsAdmin(false);
        setMe(null);
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
    const typed = comment.trim();
    if (!typed || commentPosting) return;
    // 답글이면 '@닉네임 ' 을 앞에 붙여 저장한다(상세·알림에서 파랗게 보임).
    const content = replyTo ? `@${replyTo.nickname} ${typed}` : typed;

    setCommentPosting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyTo ? { content, parentId: replyTo.id } : { content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글을 저장하지 못했습니다.");
      setComment("");
      setReplyTo(null);
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setCommentPosting(false);
    }
  }

  // 이모지 줄을 누르면 입력칸의 커서 자리에 넣는다(키보드는 내려가지 않게 유지).
  function insertEmoji(emoji: string) {
    const input = composerRef.current;
    const start = input?.selectionStart ?? comment.length;
    const end = input?.selectionEnd ?? comment.length;
    const next = comment.slice(0, start) + emoji + comment.slice(end);
    setComment(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* 일부 WebView 는 지원 안 함 */
      }
    });
  }

  function startReply(target: CommunityComment) {
    setReplyTo({ id: target.id, nickname: target.nickname });
    setComment("");
    // 키보드가 바로 뜨도록 같은 탭 안에서 포커스를 준다.
    composerRef.current?.focus();
  }

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }

  async function copyLink() {
    const url = `${window.location.origin}/community/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("링크를 복사했어요");
    } catch {
      showToast("링크를 복사하지 못했어요");
    }
  }

  async function sharePostLink() {
    if (!post) return;
    const url = `${window.location.origin}/community/${postId}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: post.title, text: post.title, url });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  // 리포스트 토글(낙관적 → 서버 확정). 목록 캐시도 같이 비운다.
  async function toggleRepost() {
    if (!post) return;
    const was = !!post.myReposted;
    const base = post.repostCount || 0;
    setPost((cur) => (cur ? { ...cur, myReposted: !was, repostCount: Math.max(0, base + (was ? -1 : 1)) } : cur));
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/repost`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "리포스트하지 못했어요.");
      setPost((cur) => (cur ? { ...cur, myReposted: !!data.reposted, repostCount: typeof data.repostCount === "number" ? data.repostCount : base } : cur));
      clientCache.clearPrefix("community-");
      showToast(data.reposted ? "내 프로필에 리포스트했어요" : "리포스트를 취소했어요");
    } catch (error) {
      setPost((cur) => (cur ? { ...cur, myReposted: was, repostCount: base } : cur));
      showToast(error instanceof Error ? error.message : "리포스트하지 못했어요.");
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

  // OX 퀴즈 — 문제 하나를 풀면 서버가 갱신된 결과를 돌려준다(한 번 고르면 변경 불가).
  async function answerQuiz(questionId: string, answer: boolean) {
    if (!post || quizBusy) return;
    setQuizBusy(questionId);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/quiz`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "퀴즈를 처리하지 못했습니다.");
      setPost({ ...post, quiz: data.quiz });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "퀴즈를 처리하지 못했습니다.");
    } finally {
      setQuizBusy(null);
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
      <PostDetailTour />
      <div className="community-detail-shell">
        <div ref={topSentinelRef} className="cpd-top-sentinel" aria-hidden="true" />
        <header className={`community-detail-topbar${scrolled ? " is-scrolled" : ""}`}>
          <button
            type="button"
            onClick={() => router.push("/community")}
            aria-label="커뮤니티 목록으로 이동"
            className="community-detail-icon-button"
            style={iconButtonStyle}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* 헤더엔 'STADY / 커뮤니티' 대신 지금 보고 있는 글 제목을 둔다 — 스크롤을 내려도
              무슨 글인지 알 수 있다. 제목이 길면 한 줄로 줄인다. */}
          <h1 className="community-detail-title">
            {post?.title ?? (loading ? "" : "커뮤니티")}
          </h1>
        </header>

        {message && (
          <div style={{ margin: "12px 20px 0", border: "1px solid var(--c-brand-line-9)", background: "var(--c-brand-soft-4)", color: "var(--c-brand-deep-2)", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500 }}>
            {message}
          </div>
        )}

        {loading && !post ? (
          // 글을 불러오는 동안 '불러오는 중...' 문구 대신 글 모양의 스켈레톤(분류·시간 / 제목 / 본문 줄 / 사진 / 공감·댓글 줄)을 보여 준다.
          <div style={{ ...panelStyle, padding: "18px 20px" }} className="cpd-sk" role="status" aria-busy="true" aria-label="게시글을 불러오는 중">
            <div className="cpd-sk-row">
              <span className="cpd-sk-b" style={{ width: 74, height: 30, borderRadius: 999 }} />
              <span className="cpd-sk-b" style={{ width: 54, height: 14 }} />
            </div>
            <span className="cpd-sk-b" style={{ width: "78%", height: 24, marginTop: 18 }} />
            <span className="cpd-sk-b" style={{ width: "52%", height: 24, marginTop: 8 }} />
            <div className="cpd-sk-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 18 }}>
              <span className="cpd-sk-b" style={{ width: 28, height: 28, borderRadius: "50%" }} />
              <span className="cpd-sk-b" style={{ width: 84, height: 14 }} />
            </div>
            <span className="cpd-sk-b" style={{ width: "100%", height: 15, marginTop: 20 }} />
            <span className="cpd-sk-b" style={{ width: "94%", height: 15, marginTop: 10 }} />
            <span className="cpd-sk-b" style={{ width: "100%", height: 15, marginTop: 10 }} />
            <span className="cpd-sk-b" style={{ width: "62%", height: 15, marginTop: 10 }} />
            <span className="cpd-sk-b" style={{ width: "100%", height: 180, marginTop: 20, borderRadius: 14 }} />
            <div className="cpd-sk-row" style={{ justifyContent: "flex-start", gap: 10, marginTop: 20 }}>
              <span className="cpd-sk-b" style={{ width: 70, height: 34, borderRadius: 999 }} />
              <span className="cpd-sk-b" style={{ width: 70, height: 34, borderRadius: 999 }} />
            </div>
          </div>
        ) : post ? (
          <>
            <article className="community-detail-panel cpd-post">
              {/* 옛 상세 배치: 맨 위 줄 = 게시판 태그 · 시간 · ⋯ */}
              <div className="cpd-top">
                {post.groupName && (
                  <span className="cpd-board" style={{ background: boardTone(post.groupName).bg, color: boardTone(post.groupName).color }}>
                    {boardShortName(post.groupName)}
                  </span>
                )}
                <span className="cpd-time" title={formatExactTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</span>
                <span className="cpd-more">
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
                  <div className="cpd-body">
                    <h2 className="cpd-title">
                      {post.groupSlug === "qna" && <QBadge answered={post.commentCount > 0} />}
                      {post.title}
                    </h2>
                    {/* 작성자 줄 — 사진 · 이름(게시판 색 그라데이션) · 등급 · 조회 */}
                    <div className="cpd-author is-link" onClick={() => post.userId && router.push(`/community/user/${post.userId}`)}>
                      <MiniAvatar nickname={post.nickname} avatar={post.avatar} size={34} />
                      <p className="cpd-name-row">
                        <span className="cpd-name" style={{ backgroundImage: boardTone(post.groupName).ink }}>{post.nickname}</span>
                        <TierBadge tier={post.authorTier} />
                        <KingBadges answer={post.authorIsAnswerKing} pick={post.authorIsPickKing} />
                        <span className="cpd-views">· 조회 {post.viewCount ?? 0}</span>
                      </p>
                    </div>
                    {post.content && <p className="cpd-content">{post.content}</p>}
                  </div>
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

              {post.quiz && post.quiz.questions.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {post.quiz.questions.map((q) => {
                    const solved = q.myAnswer !== null;
                    const correct = solved && q.myAnswer === q.correctAnswer;
                    const answers = q.oCount + q.xCount;
                    return (
                      <div key={q.id} style={{ display: "grid", gap: 9, padding: "2px 0" }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--c-text)", lineHeight: 1.5 }}>
                          {q.text}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {([true, false] as const).map((val) => {
                            const picked = q.myAnswer === val;
                            const isAnswer = solved && q.correctAnswer === val;
                            return (
                              <button
                                key={String(val)}
                                type="button"
                                disabled={solved || quizBusy === q.id}
                                onClick={() => answerQuiz(q.id, val)}
                                style={{
                                  // O / X 칸은 정사각(1:1)
                                  width: 48,
                                  height: 48,
                                  borderRadius: 14,
                                  border: "none",
                                  boxShadow: isAnswer
                                    ? `inset 0 0 0 2px ${val ? "var(--c-quiz-o-line)" : "var(--c-quiz-x-line)"}`
                                    : "none",
                                  background: val ? "var(--c-quiz-o-soft)" : "var(--c-quiz-x-soft)",
                                  color: val ? "var(--c-quiz-o)" : "var(--c-quiz-x)",
                                  opacity: solved && !isAnswer ? (picked ? 0.55 : 0.32) : 1,
                                  fontSize: 18,
                                  fontWeight: 700,
                                  cursor: solved ? "default" : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <OXMark o={val} size={22} />
                              </button>
                            );
                          })}
                          {solved ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: correct ? "var(--c-quiz-o)" : "var(--c-quiz-x)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={correct ? "/icons/emoji/quiz-correct.svg" : "/icons/emoji/quiz-wrong.svg"}
                                  alt=""
                                  width={18}
                                  height={18}
                                  style={{ display: "block" }}
                                />
                                {correct ? "정답!" : "오답"}
                              </span>
                              <span style={{ color: "var(--c-text-4)", fontWeight: 600 }}>
                                O {answers > 0 ? Math.round((q.oCount / answers) * 100) : 0}% · X {answers > 0 ? Math.round((q.xCount / answers) * 100) : 0}%
                              </span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--c-text-4)", fontWeight: 600 }}>O 또는 X를 골라보세요</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <span style={{ color: "var(--c-text-4)", fontSize: 13 }}>
                    {post.quiz.solvedCount > 0
                      ? `${post.quiz.questions.length}문제 중 ${post.quiz.solvedCount}문제 풀이 · ${post.quiz.correctCount}개 정답`
                      : `${post.quiz.questions.length}문제 · ${post.quiz.participantCount}명 참여`}
                  </span>
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

              <div className="cpd-actions" data-tour="cd-actions">
                <button type="button" className={`cpd-pill${post.myReaction ? " is-liked" : ""}`} aria-label="좋아요" aria-pressed={!!post.myReaction} onClick={() => react("heart")}>
                  <TossHeartIcon filled={!!post.myReaction} />
                  <span>좋아요 {formatCount(post.likeCount || 0)}</span>
                </button>
                <button type="button" className="cpd-pill" aria-label="댓글" onClick={() => composerRef.current?.focus()}>
                  <TossCommentIcon />
                  <span>댓글 {formatCount(post.commentCount || 0)}</span>
                </button>
                <button type="button" className={`cpd-pill${post.myReposted ? " is-reposted" : ""}`} aria-label="리포스트" aria-pressed={!!post.myReposted} onClick={toggleRepost}>
                  <TossRepostIcon />
                  {(post.repostCount || 0) > 0 && <span>{formatCount(post.repostCount || 0)}</span>}
                </button>
                <button type="button" className="cpd-pill is-icon" aria-label="공유" onClick={sharePostLink}>
                  <TossShareIcon />
                </button>
              </div>
            </article>

            <div className="cpd-band" aria-hidden="true" />
            <section className="community-detail-panel cpd-comments">
              <h2 className="cpd-c-title">댓글 <span>{formatCount(post.commentCount || 0)}</span></h2>

              {/* 댓글 입력 — 옛 상세처럼 댓글 칸 맨 위에. 이모지를 누르면 입력칸에 들어가고, 답글이면 파란 @닉네임. */}
              <div className="cpd-composer" data-tour="cd-compose">
                <div className="cpd-react-bar">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className="cpd-react"
                      aria-label={`${r.emoji} 넣기`}
                      // 누르는 순간 입력칸이 포커스를 잃어 키보드가 내려가지 않게 한다.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertEmoji(r.emoji)}
                    >
                      <ReactionIcon name={r.icon} size={28} />
                    </button>
                  ))}
                </div>
                <form className="cpd-compose" onSubmit={submitComment}>
                  <MiniAvatar nickname={me?.nickname ?? "나"} avatar={me?.avatar ?? null} size={40} />
                  <div className="cpd-bar">
                    {replyTo && (
                      <button type="button" className="cpd-mention" onClick={() => setReplyTo(null)} aria-label={`${replyTo.nickname}님 답글 취소`}>
                        @{replyTo.nickname}
                      </button>
                    )}
                    <input
                      ref={composerRef}
                      className="cpd-input"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={replyTo ? "" : "댓글로 의견을 남겨보세요"}
                      enterKeyHint="send"
                      aria-label={replyTo ? `${replyTo.nickname}님에게 답글` : "댓글"}
                    />
                    <button type="submit" className="cpd-send" disabled={commentPosting || !comment.trim()} aria-label="등록">
                      <SendUpIcon />
                    </button>
                  </div>
                </form>
              </div>

              {comments.length > 0 && (
                <div className="cpd-sorts" data-tour="cd-sort" role="tablist" aria-label="댓글 정렬">
                  {COMMENT_SORTS.map((x) => (
                    <button
                      key={x.key}
                      type="button"
                      role="tab"
                      aria-selected={commentSort === x.key}
                      className={`cpd-sort-chip${commentSort === x.key ? " on" : ""}`}
                      onClick={() => changeCommentSort(x.key)}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              )}

              {comments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 0 24px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/toss/sleeping.svg" alt="" width={44} height={44} style={{ display: "block", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, color: "var(--c-text-4)", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>댓글이 자고있나봐요<br />깨워주세요!</p>
                </div>
              ) : (
                <div className="cpd-clist">
                  {comments.map((item) => (
                    <CommentItem
                      key={item.id}
                      comment={item}
                      currentUserId={currentUserId}
                      onBlocked={() => loadDetail()}
                      activeReplyId={replyTo?.id ?? ""}
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
                      onReply={startReply}
                    />
                  ))}
                </div>
              )}
            </section>

            {toast && <div className="cpd-toast" role="status">{toast}</div>}
          </>
        ) : (
          <div style={panelStyle}>
            <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14 }}>게시글을 찾을 수 없습니다.</p>
          </div>
        )}
      </div>
      <style>{`
        /* 글 불러오는 중 스켈레톤 — 천천히 숨 쉬듯 밝아졌다 어두워진다 */
        .cpd-sk-row { display: flex; align-items: center; justify-content: space-between; }
        .cpd-sk-b { display: block; border-radius: 8px; background: var(--c-bg-muted-6, rgba(0,0,0,0.06)); animation: cpdSkPulse 1.4s ease-in-out infinite; }
        @keyframes cpdSkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media (prefers-reduced-motion: reduce) { .cpd-sk-b { animation: none; } }
        .community-detail-page {
          min-height: 100vh;
          background: var(--c-bg);
          color: var(--c-text);
          padding: 0 0 calc(40px + env(safe-area-inset-bottom, 0px));
        }
        .community-detail-shell {
          max-width: 760px;
          margin: 0 auto;
          display: block;
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
          background: transparent;
        }
        /* 맨 위에서는 배경·테두리가 없다. 스크롤을 내리면 배경색이 위에서 아래로 옅어지는 그라데이션이 스르륵 나온다. */
        .community-detail-topbar::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: calc(100% + 22px);
          background: linear-gradient(to bottom, var(--c-bg) 0%, var(--c-bg) 55%, transparent 100%);
          opacity: 0;
          transition: opacity 0.28s ease;
          pointer-events: none;
        }
        .community-detail-topbar.is-scrolled::before { opacity: 1; }
        .community-detail-topbar > * { position: relative; z-index: 1; }
        .cpd-top-sentinel { position: absolute; top: 0; left: 0; width: 1px; height: 1px; pointer-events: none; }
        .community-detail-icon-button {
          flex-shrink: 0;
          transition: background-color 0.14s ease, color 0.14s ease;
        }
        .community-detail-icon-button:active {
          opacity: 0.5;
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
          background: transparent !important;
          border-color: transparent !important;
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
        .community-reply-button:active {
          transform: scale(0.97);
        }
        .rp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 4px 2px; border: none; background: none; color: #6B7684; font-size: 15px; font-weight: 500; letter-spacing: -0.2px; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; }
        /* ── 토스식 글 상세(프리티풀 tdet 와 같은 문법) ── */
        .cpd-post { padding: 16px 20px 0; display: grid; gap: 14px; }
        /* 맨 위 줄: 게시판 태그 · 시간 · ⋯ (옛 상세 배치, 지금 톤) */
        .cpd-top { display: flex; align-items: center; gap: 8px; }
        .cpd-board { display: inline-flex; align-items: center; height: 28px; padding: 0 11px; border-radius: 999px; font-size: 13.5px; font-weight: 700; letter-spacing: -0.2px; white-space: nowrap; }
        .cpd-time { color: var(--c-text-4c, #8b95a1); font-size: 14px; font-weight: 500; letter-spacing: -0.2px; }
        .cpd-author { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .cpd-author.is-link { cursor: pointer; }
        .cpd-views { margin-left: 4px; color: var(--c-text-4c, #8b95a1); font-size: 14px; font-weight: 500; -webkit-text-fill-color: currentColor; }
        .cpd-name-row { margin: 0; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; font-size: 15.5px; font-weight: 700; letter-spacing: -0.3px; }
        .cpd-name { min-width: 0; overflow-wrap: anywhere; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
        .cpd-body { display: grid; gap: 14px; }
        .cpd-title { margin: 0; color: var(--c-text); font-size: 23px; line-height: 1.4; font-weight: 700; letter-spacing: -0.5px; }
        .cpd-content { margin: 0; color: var(--c-text); font-size: 17.5px; line-height: 1.7; letter-spacing: -0.3px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .cpd-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 4px 0 18px; }
        .cpd-pill { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px 0 11px; border: none; border-radius: 999px; background: var(--c-bg-muted-2, #f2f4f6); color: var(--c-text-3, #6b7684); font-size: 14.5px; font-weight: 600; letter-spacing: -0.2px; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
        .cpd-pill svg { width: 20px; height: 20px; }
        .cpd-pill:active { transform: scale(0.96); }
        .cpd-pill.is-icon { width: 38px; padding: 0; justify-content: center; }
        .cpd-pill.is-liked { color: #f04452; background: rgba(240, 68, 82, 0.1); }
        .cpd-pill.is-reposted { color: #03a94d; background: rgba(3, 169, 77, 0.1); }
        .cpd-pill.is-reposted svg { animation: repostSpin 0.55s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes repostSpin { from { transform: rotate(-180deg) scale(0.7); } to { transform: none; } }
        .cpd-more { margin-left: auto; display: inline-flex; }
        .cpd-band { height: 10px; background: var(--c-bg-muted-2, #f2f4f6); }
        .cpd-comments { padding: 0 20px; }
        .cpd-c-title { margin: 20px 0 12px; color: var(--c-text); font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
        .cpd-c-title span { color: #3182f6; }
        .cpd-composer { padding-bottom: 6px; }
        .cpd-sorts { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 0 4px; }
        .cpd-sort-chip { height: 32px; padding: 0 13px; border: none; border-radius: 999px; background: var(--c-bg-muted-2, #f2f4f6); color: var(--c-text-3, #6b7684); font-size: 14px; font-weight: 600; letter-spacing: -0.2px; cursor: pointer; font-family: inherit; transition: background 0.15s ease, color 0.15s ease; }
        .cpd-sort-chip.on { background: var(--c-inverse, #191f28); color: #fff; }
        @keyframes cpdMenuIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        .cpd-clist { display: grid; }
        .cpd-c { display: flex; gap: 12px; padding: 18px 0 14px; }
        .cpd-c.is-reply { padding: 14px 0 6px; }
        .cpd-c.is-pinned { background: var(--c-warn-soft, transparent); margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
        .cpd-c-main { min-width: 0; flex: 1; }
        .cpd-c-pin { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 12px; font-weight: 700; color: var(--c-warn-d, #b45309); }
        .cpd-c-head { display: flex; align-items: center; flex-wrap: wrap; gap: 0; }
        .cpd-c-name { color: var(--c-text-3, #6b7684); font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
        .cpd-c-time { margin-left: 5px; color: var(--c-text-4c, #8b95a1); font-size: 15px; font-weight: 500; }
        .cpd-c-text { margin: 4px 0 0; color: var(--c-text); font-size: 17px; line-height: 1.6; letter-spacing: -0.3px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .cpd-c-acts { display: flex; align-items: center; gap: 16px; margin-top: 6px; color: #6b7684; }
        .cpd-c-like { display: inline-flex; align-items: center; gap: 4px; padding: 4px 2px; border: none; background: none; color: inherit; font-size: 15px; font-weight: 500; font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .cpd-c-like.is-liked { color: #f04452; }
        .cpd-c-text-btn { padding: 4px 2px; border: none; background: none; color: #6b7684; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .cpd-c-text-btn.is-danger { color: var(--c-danger-b, #e8544e); }
        .cpd-c-replies { margin-top: 2px; }
        .cpd-c.is-active > .cpd-c-main > .cpd-c-text { background: rgba(49, 130, 246, 0.07); border-radius: 8px; }
        /* 아래 고정 입력 영역 */
        .cpd-react-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 8px; }
        .cpd-react { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: none; border-radius: 14px; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease; }
        .cpd-react:active { transform: scale(0.86); }
        .cpd-compose { display: flex; align-items: center; gap: 10px; }
        .cpd-bar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; box-sizing: border-box; height: 52px; padding: 8px 8px 8px 18px; border-radius: 26px; background: var(--c-bg-muted-2, #f2f4f6); }
        .cpd-mention { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0; border: none; background: none; color: #3182f6; font-size: 16px; font-weight: 500; letter-spacing: -0.2px; font-family: inherit; cursor: pointer; }
        .cpd-input { flex: 1; min-width: 0; height: 36px; border: none; outline: none; background: transparent; color: var(--c-text); font-size: 16px; font-family: inherit; caret-color: #3182f6; padding: 0; }
        .cpd-input::placeholder { color: var(--c-text-5, #b0b8c1); }
        .cpd-send { flex: none; width: 48px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 18px; background: #3182f6; cursor: pointer; transition: background 0.15s ease, transform 0.12s ease; }
        .cpd-send:active:not(:disabled) { transform: scale(0.94); }
        .cpd-send:disabled { background: #d1d6db; cursor: default; }
        .cpd-toast { position: fixed; left: 50%; bottom: calc(40px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 300; padding: 12px 18px; border-radius: 12px; background: rgba(25, 31, 40, 0.92); color: #fff; font-size: 15px; font-weight: 600; white-space: nowrap; pointer-events: none; }
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
  /** 지금 아래 입력창이 답글을 달고 있는 댓글 id(강조용). */
  activeReplyId: string;
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
  onReply: (comment: CommunityComment) => void;
  currentUserId: string | null;
  /** 차단 후 댓글 목록을 다시 불러온다. */
  onBlocked: () => void;
  depth?: number;
}

// 토스식 댓글 한 줄: 아바타 · 이름 · 시간 / 본문 / 하트 · 답글 달기 · ⋯ . 답글은 본문 칸 안에 들여써서 이어진다.
function CommentItem({
  comment,
  activeReplyId,
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
  onReply,
  currentUserId,
  onBlocked,
  depth = 0,
}: CommentItemProps) {
  const router = useRouter();
  const goProfile = () => { if (comment.userId) router.push(`/community/user/${comment.userId}`); };
  const isEditing = editingCommentId === comment.id;
  const rowClass = `cpd-c${depth > 0 ? " is-reply" : ""}${isPinned ? " is-pinned" : ""}${activeReplyId === comment.id ? " is-active" : ""}`;
  return (
    <div className={rowClass}>
      <span onClick={goProfile} style={{ cursor: comment.userId ? "pointer" : undefined, flexShrink: 0, display: "inline-flex", alignSelf: "flex-start" }}>
        <MiniAvatar nickname={comment.nickname} avatar={comment.avatar} size={depth > 0 ? 34 : 44} />
      </span>
      <div className="cpd-c-main">
        {isPinned && (
          <div className="cpd-c-pin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/pin-star.svg" alt="" width={14} height={14} style={{ display: "block" }} />
            고정
          </div>
        )}
        <div className="cpd-c-head">
          <strong className="cpd-c-name" onClick={goProfile} style={{ cursor: comment.userId ? "pointer" : undefined }}>{comment.nickname}</strong>
          <TierBadge tier={comment.authorTier} />
          <KingBadges answer={comment.authorIsAnswerKing} pick={comment.authorIsPickKing} />
          <span className="cpd-c-time" title={formatExactTime(comment.createdAt)}>· {formatRelativeTime(comment.createdAt)}</span>
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
          <p className="cpd-c-text">{renderWithMention(comment.content)}</p>
        )}
        <div className="cpd-c-acts">
          <button type="button" className={`cpd-c-like${comment.likedByMe ? " is-liked" : ""}`} aria-label="공감" aria-pressed={comment.likedByMe} onClick={() => onToggleLike(comment.id)}>
            <TossHeartIcon filled={comment.likedByMe} />
            {comment.likeCount > 0 && <span>{formatCount(comment.likeCount)}</span>}
          </button>
          <button type="button" className="rp-btn" data-tour={depth === 0 ? "cd-reply" : undefined} onClick={() => onReply(comment)}>
            <ReplyArrowIcon />
            답글 달기
          </button>
          {canPin && depth === 0 && (
            <button type="button" className="cpd-c-text-btn" onClick={() => onTogglePin?.(comment.id)} disabled={pinBusy}>
              {isPinned ? "고정 해제" : "고정"}
            </button>
          )}
          {isAdmin && !isEditing && (
            <>
              <button type="button" className="cpd-c-text-btn" onClick={() => onStartEdit(comment)}>수정</button>
              <button type="button" className="cpd-c-text-btn is-danger" onClick={() => onDelete(comment.id)}>삭제</button>
            </>
          )}
          <span className="cpd-more">
            <ReportBlockMenu
              targetType="comment"
              commentId={comment.id}
              targetUserId={comment.userId}
              targetNickname={comment.nickname}
              currentUserId={currentUserId}
              onBlocked={onBlocked}
              variant="dots"
            />
          </span>
        </div>
        {comment.replies.length > 0 && (
          <div className="cpd-c-replies">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onBlocked={onBlocked}
                activeReplyId={activeReplyId}
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
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
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
  width: 40,
  height: 40,
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: "var(--c-text)",
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
