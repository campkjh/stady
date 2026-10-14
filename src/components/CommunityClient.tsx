"use client";

import { type CSSProperties, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityPostDetailClient from "@/components/CommunityPostDetailClient";
import CommunityComposeModal from "@/components/CommunityComposeModal";
import PrimeReferralSheet from "@/components/PrimeReferralSheet";
import IntroBanner from "@/components/IntroBanner";
import BlindNoiseCover from "@/components/BlindNoiseCover";
import { clientCache } from "@/lib/clientCache";
import KingBadges from "@/components/KingBadges";
import ReportBlockMenu from "@/components/ReportBlockMenu";
import { TossHeartIcon, TossCommentIcon, TossRepostIcon, TossShareIcon, formatCount } from "@/components/community/TossIcons";
import { boardTone, boardShortName } from "@/lib/boardTone";
import EmojiBar from "@/components/community/EmojiBar";
import { CommunityTour } from "@/components/tours";
import { renderWithMention } from "@/components/community/mention";
import { ReplyArrowIcon, SortArrowsIcon, SendUpIcon } from "@/components/community/TossIcons";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useModalExit } from "@/lib/useModalExit";
import PullToRefresh from "@/components/PullToRefresh";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import { formatRelativeTime, formatExactTime } from "@/lib/relativeTime";

// 게시글 목록 캐시 키(필터 조합별).
const postsKey = (groupId: string, q: string) =>
  `community-posts:${groupId}:${q.trim()}`;

interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface CommunityTag {
  id: string;
  groupId: string;
  name: string;
  slug: string;
}

interface CommunityPollOption {
  id: string;
  text: string;
  sort_order: number;
  votes: number;
}
interface CommunityPoll {
  options: CommunityPollOption[];
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

interface CommunityTopComment {
  id: string;
  nickname: string;
  content: string;
  likeCount: number;
  pinned: boolean;
}

interface Liker {
  userId: string;
  nickname: string;
  avatar: string | null;
}

interface CommunityPost {
  id: string;
  userId?: string | null; // 작성자 id(API mapPost 가 내려준다) — 내 글 필터용
  nickname: string;
  avatar?: string | null;
  likers?: Liker[];
  authorTier?: string;
  authorIsAdmin?: boolean;
  authorIsAnswerKing?: boolean;
  authorIsPickKing?: boolean;
  repostCount?: number;
  myReposted?: boolean;
  groupName: string;
  groupSlug?: string;
  title: string;
  content: string;
  type?: string;
  poll?: CommunityPoll | null;
  quiz?: CommunityQuiz | null;
  topComment?: CommunityTopComment | null;
  myReaction?: string | null;
  isBlinded?: boolean;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  imageUrls: string[];
  tags: CommunityTag[];
}

const TIERS = ["iron", "silver", "gold", "emerald", "diamond", "master", "grandmaster", "gongsin"];
function TierBadge({ tier }: { tier?: string }) {
  if (!tier || !TIERS.includes(tier)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/tier-${tier}.svg`} alt="" width={15} height={15} style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4, flexShrink: 0 }} />
  );
}

function QBadge({ answered }: { answered: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={answered ? "/icons/quiz-q-answered.svg" : "/icons/quiz-q-gray.svg"} alt={answered ? "답변완료" : "미답변"} width={18} height={18} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 5 }} />
  );
}

export default function CommunityClient() {
  const router = useRouter();
  // 넓은 화면에서 목록 위에 띄우는 상세 패널(글 id). null 이면 닫힘.
  const [panelPostId, setPanelPostId] = useState<string | null>(null);
  useEffect(() => {
    if (!panelPostId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanelPostId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelPostId]);
  // 창이 좁아지면(태블릿 세로 회전 등) 패널을 닫는다 — 좁은 화면에서 38% 패널은 못 읽는다.
  useEffect(() => {
    if (!panelPostId) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (!mq.matches) setPanelPostId(null); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [panelPostId]);
  const topbarRef = useRef<HTMLElement | null>(null);
  // 캐시된 값으로 초기화 → 탭 재진입 시 즉시 표시(로딩/깜빡임 없음).
  const [groups, setGroups] = useState<CategoryGroup[]>(() => clientCache.get<CategoryGroup[]>("community-groups") ?? []);
  // 카테고리를 아직 못 받은 동안(앱 첫 진입)엔 빈 자리 대신 자리표시 탭을 그려 '뚝' 생기지 않게 하고,
  // 받은 뒤 새로 생기는 탭은 살며시 나타나게 한다. 직전에 본 목록은 localStorage 에 남겨 다음 진입엔 즉시 그린다.
  const [groupsReady, setGroupsReady] = useState(() => clientCache.has("community-groups"));
  const [groupsFade, setGroupsFade] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>(() => clientCache.get<CommunityPost[]>(postsKey("", "")) ?? []);
  const [weeklyPosts, setWeeklyPosts] = useState<CommunityPost[]>(() => clientCache.get<CommunityPost[]>("community-weekly") ?? []);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // 검색창이 '열리는 중/닫히는 중'에도 화면에 남아 있어야 전환이 보인다: mounted = DOM 에 있음, searchOn = 펼친 상태.
  const [searchMounted, setSearchMounted] = useState(false);
  const [searchOn, setSearchOn] = useState(false);
  const searchCloseTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  function openSearch() {
    if (searchCloseTimer.current) window.clearTimeout(searchCloseTimer.current);
    setSearchOpen(true);
    setSearchMounted(true);
    // 접힌 모양으로 한 프레임 그린 뒤 펼친 모양으로 바꿔야 CSS 전환이 돈다
    requestAnimationFrame(() => requestAnimationFrame(() => setSearchOn(true)));
  }
  function closeSearch() {
    setSearchOn(false);
    searchInputRef.current?.blur();
    searchCloseTimer.current = window.setTimeout(() => {
      setSearchMounted(false);
      setSearchOpen(false);
      setQuery("");
    }, 520);
  }
  const [message, setMessage] = useState("");
  // 주간 인기글 옆 '내 글 / 내 댓글' 필터. 전체 탭·검색 없음일 때만 보인다.
  // 글 상세로 갔다가 돌아와도 필터가 유지되도록 sessionStorage 에 두고 복원한다(스크롤 복원과 같은 방식).
  // 초기값은 서버와 같게 "" 로 두고 마운트 후 복원한다(초기화 함수에서 sessionStorage 를 읽으면 하이드레이션 불일치).
  const [mineFilter, setMineFilterState] = useState<"" | "posts" | "comments">("");
  const setMineFilter = (v: "" | "posts" | "comments") => {
    setMineFilterState(v);
    try {
      if (v) sessionStorage.setItem("community-mine-filter", v);
      else sessionStorage.removeItem("community-mine-filter");
    } catch { /* ignore */ }
  };
  const [meId, setMeId] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  // 내가 댓글 단 글 id → 내 최신 댓글 내용(카드 미리보기에 내 댓글을 보여준다).
  const [myCommentByPost, setMyCommentByPost] = useState<Map<string, string> | null>(null);
  // 캐시가 있으면 로딩 표시 안 함(데이터 변동 시에만 갱신).
  const [loading, setLoading] = useState(() => !clientCache.has(postsKey("", "")));
  const [topbarHeight, setTopbarHeight] = useState(0);
  const scrollRestoredRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);
  // 스크롤을 내리면 헤더 뒤로 배경색 그라데이션이 스르륵 나온다(카테고리 탭은 항상 아이콘 옆 글자 한 줄).
  const [headerScrolled, setHeaderScrolled] = useState(false);
  // 목록은 처음 20개만 그리고, 아래로 내리면 20개씩 더 그린다(500개를 한꺼번에 그리면 진입이 느려진다).
  const [renderCount, setRenderCount] = useState(20);
  const renderMoreRef = useRef<HTMLDivElement | null>(null);
  const filterMountedRef = useRef(false);
  // 블라인드 노이즈를 탭해서 공개한 글 id 모음(피드에서 바로 걷기).
  const [revealedBlind, setRevealedBlind] = useState<Set<string>>(() => new Set());
  // 지금 투표 요청 중인 글 id(중복 클릭 방지).
  const [votingPostId, setVotingPostId] = useState<string | null>(null);
  const [answeringQuizId, setAnsweringQuizId] = useState<string | null>(null);
  // 목록에서 바로 좋아요/댓글: 좋아요 진행중 글 id, 댓글 모달을 띄운 글.
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [commentModalPost, setCommentModalPost] = useState<CommunityPost | null>(null);
  // 스레드 스타일 글 작성 모달.
  const [composeOpen, setComposeOpen] = useState(false);
  // 다른 화면(문제 오류 건의 등)에서 ?compose=1&text=...&group=... 로 들어오면
  // 글쓰기 화면을 미리 채워서 연다.
  const [composePreset, setComposePreset] = useState<{ text: string; group: string } | null>(null);

  // 링크 복사·공유(토스 피드의 리포스트·공유 아이콘 자리). 복사하면 아래에 잠깐 토스트를 띄운다.
  const [linkToast, setLinkToast] = useState("");
  const linkToastTimer = useRef<number | null>(null);
  function showLinkToast(text: string) {
    setLinkToast(text);
    if (linkToastTimer.current) window.clearTimeout(linkToastTimer.current);
    linkToastTimer.current = window.setTimeout(() => setLinkToast(""), 1800);
  }
  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }
  async function copyPostLink(post: CommunityPost) {
    const ok = await copyText(`${window.location.origin}/community/${post.id}`);
    showLinkToast(ok ? "링크를 복사했어요" : "링크를 복사하지 못했어요");
  }
  async function sharePost(post: CommunityPost) {
    const url = `${window.location.origin}/community/${post.id}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: post.title, text: post.title, url });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
      }
    }
    const ok = await copyText(url);
    showLinkToast(ok ? "링크를 복사했어요" : "공유하지 못했어요");
  }

  // 리포스트 토글(낙관적 → 서버 확정). 내 프로필 활동에 원글이 올라간다.
  async function toggleRepost(post: CommunityPost) {
    const was = !!post.myReposted;
    const base = post.repostCount || 0;
    const apply = (reposted: boolean, count: number) =>
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === post.id ? { ...p, myReposted: reposted, repostCount: count } : p));
        clientCache.set(postsKey(selectedGroupId, query), next);
        return next;
      });
    apply(!was, Math.max(0, base + (was ? -1 : 1)));
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/repost`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "리포스트하지 못했어요.");
      apply(!!data.reposted, typeof data.repostCount === "number" ? data.repostCount : base);
      showLinkToast(data.reposted ? "내 프로필에 리포스트했어요" : "리포스트를 취소했어요");
    } catch (error) {
      apply(was, base);
      showLinkToast(error instanceof Error ? error.message : "리포스트하지 못했어요.");
    }
  }

  // 목록에서 좋아요 토글(상세 진입 불필요). 낙관적 갱신 후 서버 결과로 확정.
  async function toggleLike(post: CommunityPost) {
    if (likingPostId) return;
    setLikingPostId(post.id);
    const wasLiked = !!post.myReaction;
    // 낙관적 갱신
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, myReaction: wasLiked ? null : "heart", likeCount: Math.max(0, (p.likeCount || 0) + (wasLiked ? -1 : 1)) }
          : p
      )
    );
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: wasLiked ? null : "heart" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "공감을 처리하지 못했습니다.");
      // 서버 확정값으로 동기화
      setPosts((prev) => {
        const next = prev.map((p) =>
          p.id === post.id ? { ...p, myReaction: data.myReaction ?? null, likeCount: data.total ?? p.likeCount } : p
        );
        clientCache.set(postsKey(selectedGroupId, query), next);
        return next;
      });
    } catch (error) {
      // 실패 시 롤백
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, myReaction: wasLiked ? "heart" : null, likeCount: post.likeCount } : p
        )
      );
      setMessage(error instanceof Error ? error.message : "공감을 처리하지 못했습니다.");
    } finally {
      setLikingPostId(null);
    }
  }

  // 댓글 모달에서 댓글이 추가되면 목록 카드의 댓글 수도 +1.
  function bumpCommentCount(postId: string, delta: number) {
    setPosts((prev) => {
      const next = prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) } : p));
      clientCache.set(postsKey(selectedGroupId, query), next);
      return next;
    });
  }

  // 딥링크로 들어온 글쓰기 요청 — 한 번 열고 주소는 깨끗하게 되돌린다.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("compose") !== "1") return;
    const preset = { text: sp.get("text") || "", group: sp.get("group") || "" };
    const t = setTimeout(() => {
      setComposePreset(preset);
      setComposeOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // 목록에서 바로 OX 퀴즈 풀기 — 문제 하나를 누르면 그 글의 quiz 만 갱신한다.
  async function answerQuiz(postId: string, questionId: string, answer: boolean) {
    if (answeringQuizId) return;
    setAnsweringQuizId(questionId);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/quiz`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "퀴즈를 처리하지 못했습니다.");
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === postId ? { ...p, quiz: data.quiz } : p));
        clientCache.set(postsKey(selectedGroupId, query), next);
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "퀴즈를 처리하지 못했습니다.");
    } finally {
      setAnsweringQuizId(null);
    }
  }

  // 목록에서 바로 투표. 결과를 받아 해당 글의 poll 만 갱신한다(상세 진입 불필요).
  async function votePoll(postId: string, optionId: string) {
    if (votingPostId) return;
    setVotingPostId(postId);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "투표를 처리하지 못했습니다.");
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === postId ? { ...p, poll: data.poll } : p));
        // 현재 필터 조합의 캐시도 갱신해 탭 재진입 시 투표 상태가 유지되게 한다.
        clientCache.set(postsKey(selectedGroupId, query), next);
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "투표를 처리하지 못했습니다.");
    } finally {
      setVotingPostId(null);
    }
  }

  // 하이드레이션 직후 첫 페인트 전에 저장해 둔 카테고리를 채운다(서버 HTML 과 달라지지 않게 effect 로).
  useLayoutEffect(() => {
    if (clientCache.has("community-groups")) return;
    try {
      const raw = window.localStorage.getItem("stady:community-groups");
      const saved = raw ? (JSON.parse(raw) as CategoryGroup[]) : null;
      if (Array.isArray(saved) && saved.length > 0) {
        clientCache.set("community-groups", saved);
        setGroups(saved);
        setGroupsReady(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadGroups();
    loadWeeklyPopular();
  }, []);

  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return;

    const updateTopbarHeight = () => {
      setTopbarHeight(Math.ceil(topbar.getBoundingClientRect().height));
    };

    updateTopbarHeight();
    window.addEventListener("resize", updateTopbarHeight);

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateTopbarHeight) : null;
    observer?.observe(topbar);

    return () => {
      window.removeEventListener("resize", updateTopbarHeight);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, query]);

  // 상세에서 돌아온 경우 저장해 둔 필터를 복원하고, 필요한 데이터를 다시 받는다.
  useEffect(() => {
    let v: string | null = null;
    try { v = sessionStorage.getItem("community-mine-filter"); } catch { /* ignore */ }
    if (v === "posts" || v === "comments") {
      setMineFilterState(v);
      ensureMineData(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 6;
      setHeaderScrolled((cur) => (cur === next ? cur : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 필터가 바뀌면 처음 20개부터 다시. (첫 마운트는 건너뛴다)
  useEffect(() => {
    if (!filterMountedRef.current) {
      filterMountedRef.current = true;
      return;
    }
    setRenderCount(20);
  }, [selectedGroupId, query, mineFilter]);

  // 상세에서 돌아와 스크롤을 복원해야 하면 목록 전체를 그려 높이를 확보한다.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("community-scroll")) setRenderCount(500);
    } catch { /* 저장소 막힘 */ }
  }, []);

  // 목록 맨 아래 감시점이 보이기 직전(800px 전)에 20개씩 더 그린다.
  useEffect(() => {
    const el = renderMoreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setRenderCount((c) => c + 20);
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });

  // 상세에서 돌아왔을 때(목록 첫 로드 완료 시점) 저장해둔 스크롤 위치로 복원.
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (loading || posts.length === 0) return; // 실제 목록이 렌더된 뒤에만 복원
    if (selectedGroupId || query.trim()) {
      scrollRestoredRef.current = true;
      return;
    }
    scrollRestoredRef.current = true;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem("community-scroll"); } catch {}
    if (!saved) return;
    try { sessionStorage.removeItem("community-scroll"); } catch {}
    const y = parseInt(saved, 10);
    if (Number.isNaN(y) || y <= 0) return;
    // 카드/이미지가 점차 렌더되며 목록 높이가 늘어나므로, 목표 위치에 닿을 때까지
    // (또는 최대 ~1.2초) 반복 적용한다.
    let tries = 0;
    restoreTimerRef.current = window.setInterval(() => {
      window.scrollTo(0, y);
      tries += 1;
      if (Math.abs(window.scrollY - y) <= 2 || tries >= 24) {
        if (restoreTimerRef.current) window.clearInterval(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, posts]);

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) window.clearInterval(restoreTimerRef.current);
    };
  }, []);

  async function loadGroups() {
    try {
      const response = await fetch("/api/category-groups");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "카테고리를 불러오지 못했습니다.");
      // "자유"를 맨 앞으로 (나머지는 기존 순서 유지).
      const ordered = [...(data.groups || [])].sort((a, b) => {
        if (a.name === "자유") return -1;
        if (b.name === "자유") return 1;
        return 0;
      });
      if (clientCache.set("community-groups", ordered)) {
        // 저장해 둔 목록과 같으면(이미 그려져 있음) 다시 그리지 않는다.
        setGroups((prev) => {
          if (prev.length === 0) setGroupsFade(true);
          return ordered;
        });
      }
      setGroupsReady(true);
      try { window.localStorage.setItem("stady:community-groups", JSON.stringify(ordered)); } catch {}
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.");
    }
  }

  async function toggleMineFilter(next: "posts" | "comments") {
    const turnOff = mineFilter === next;
    setMineFilter(turnOff ? "" : next);
    if (turnOff) return;
    await ensureMineData(next);
  }

  // 필터에 필요한 데이터(내 id, 내 댓글 글 목록)를 없을 때만 받는다.
  async function ensureMineData(next: "posts" | "comments") {
    if (!meLoaded) {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const d = r.ok ? await r.json() : null;
        setMeId(d?.user?.id ?? null);
      } catch {
        setMeId(null);
      } finally {
        setMeLoaded(true);
      }
    }
    if (next === "comments" && myCommentByPost === null) {
      try {
        const r = await fetch("/api/me/comments", { credentials: "include" });
        const d = r.ok ? await r.json() : { comments: [] };
        const m = new Map<string, string>();
        for (const c of d.comments || []) if (!m.has(c.postId)) m.set(c.postId, c.content); // 최신순이라 첫 것이 최신
        setMyCommentByPost(m);
      } catch {
        setMyCommentByPost(new Map());
      }
    }
  }

  async function loadPosts() {
    const key = postsKey(selectedGroupId, query);
    // 캐시가 있으면 즉시 표시하고 로딩을 띄우지 않는다(백그라운드 재검증).
    const cached = clientCache.get<CommunityPost[]>(key);
    if (cached) {
      setPosts(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (selectedGroupId) params.set("groupId", selectedGroupId);
      if (query.trim()) params.set("q", query.trim());
      // 전체 목록(최대 500개)은 응답이 크고 느리다. 캐시가 없으면 앞쪽 20개만 먼저 받아 바로 그리고,
      // 전체는 같이 요청해 뒤이어 채운다. 상세에서 돌아와 스크롤을 복원해야 할 땐 목록이 길어야 하므로 건너뛴다.
      let skipQuick = false;
      try { skipQuick = !!sessionStorage.getItem("community-scroll"); } catch {}
      const fullPromise = fetch(`/api/community/posts?${params.toString()}`);
      let fullDone = false;
      if (!cached && !skipQuick) {
        const quickParams = new URLSearchParams(params);
        quickParams.set("limit", "20");
        const quickPromise = fetch(`/api/community/posts?${quickParams.toString()}`)
          .then(async (res) => (res.ok ? (await res.json()).posts : null))
          .catch(() => null);
        quickPromise.then((quick) => {
          // 전체가 먼저 도착했으면 건너뛴다(덮어쓰지 않게)
          if (!fullDone && Array.isArray(quick) && quick.length > 0) {
            setPosts(quick);
            setLoading(false);
          }
        });
      }
      const response = await fullPromise;
      fullDone = true;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
      const fresh = data.posts || [];
      // 달라졌을 때만 갱신(데이터 변동 시에만 리렌더). 앞쪽 20개만 보이던 상태면 캐시가 비어 있으므로 set 이 항상 true 다.
      if (clientCache.set(key, fresh)) setPosts(fresh);
      else if (!cached) setPosts(fresh);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWeeklyPopular() {
    try {
      const response = await fetch("/api/community/posts?popular=week");
      const data = await response.json();
      if (response.ok) {
        const fresh = data.posts || [];
        if (clientCache.set("community-weekly", fresh)) setWeeklyPosts(fresh);
      }
    } catch {
      // 주간 인기글은 보조 섹션이라 실패해도 조용히 무시한다.
    }
  }

  // 필터는 전체 탭·검색 없음일 때만 유효(칩이 그때만 보이므로).
  const activeMineFilter = !selectedGroupId && !query.trim() ? mineFilter : "";
  const visiblePosts: CommunityPost[] =
    activeMineFilter === "posts"
      ? posts.filter((p) => !!meId && p.userId === meId)
      : activeMineFilter === "comments"
        ? posts
            .filter((p) => !!myCommentByPost && myCommentByPost.has(p.id))
            .map((p) => ({ ...p, topComment: { id: "mine-" + p.id, nickname: "내 댓글", content: myCommentByPost!.get(p.id) || "", likeCount: 0, pinned: false } }))
        : posts;

  // 글 카드의 아바타·이름을 누르면 그 사람 프로필로(카드 자체의 '상세 열기'와 겹치지 않게 전파를 막는다).
  function openProfile(event: { stopPropagation: () => void }, userId?: string | null) {
    if (!userId) return;
    event.stopPropagation();
    router.push(`/community/user/${userId}`);
  }

  function openPost(postId: string) {
    // 넓은 화면에서는 페이지를 갈아엎지 않고 우측 패널로 연다 — 목록 자리를 지킨 채
    // 글을 훑어볼 수 있다. 좁은 화면은 예전처럼 상세 페이지로 이동한다.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setPanelPostId(postId);
      return;
    }
    // 상세로 가기 전 현재 스크롤 위치를 저장해 두고, 돌아오면 그 자리로 복원한다.
    try { sessionStorage.setItem("community-scroll", String(window.scrollY)); } catch {}
    router.push(`/community/${postId}`);
  }

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );
  // 목록 이미지는 전부 lazy 인데, 그중 처음 보이는 한 장만 예외로 즉시 받는다(LCP).
  // 맨 위 글에 이미지가 없는 경우가 흔해서 "이미지가 있는 첫 글"을 기준으로 잡는다.
  const firstImagePostIndex = useMemo(
    () => posts.findIndex((post) => post.imageUrls.length > 0),
    [posts]
  );
  return (
    <main className="community-page" style={{ "--community-header-height": `${topbarHeight}px` } as CSSProperties}>
      {/* 커뮤니티 진입 시 하단에서 올라오는 친구초대 시트(일주일 동안 안보기 지원) */}
      {/* 첫 진입 배너(X = 3일 동안 안 보기) — 초대 시트보다 위에 뜬다 */}
      <IntroBanner
        image="/banners/community-answer-king.jpg"
        alt="답변왕에게 스타디 프라임 7일 제공"
        storageKey="community_intro_answerking_hidden_until"
      />
      <PrimeReferralSheet />
      <header ref={topbarRef} className={`community-topbar${headerScrolled ? " is-scrolled" : ""}${searchOn ? " is-searching" : ""}`}>
        <div className="community-topbar-inner">
          <div className="community-title-wrap">
            <h1 className="community-title">커뮤니티</h1>
          </div>
          {/* 모바일: 제목 줄 아래 따로 있던 카테고리 탭을 헤더 한 줄로 합친다(세로 공간 절약). */}
          <div className="community-mobile-filters">
            <CategoryChips
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={(id) => setSelectedGroupId(id)}
              pending={!groupsReady && groups.length === 0}
              fadeIn={groupsFade}
            />
          </div>
          {/* 넓은 화면: 아이콘 버튼 대신 헤더에 검색창을 그대로 편다. */}
          <div className="community-search-inline">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="무엇을 검색하실건가요?"
              aria-label="커뮤니티 검색"
            />
            {query && (
              <button type="button" className="community-search-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            className="community-icon-button"
            onClick={() => (searchOpen ? closeSearch() : openSearch())}
            aria-label="커뮤니티 검색"
            title="검색"
            style={iconButtonStyle}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {/* 검색 버튼 자리에서 헤더 전체로 쭉 펼쳐지는 입력창(회색 알약). 탭은 옆으로 비켜 사라진다. */}
          {searchMounted && (
            <div className={`csb${searchOn ? " is-open" : ""}`} role="search">
              <div className="csb-pill">
                <svg className="csb-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  className="csb-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }}
                  placeholder={selectedGroup ? `${selectedGroup.name}에서 검색` : "커뮤니티 검색"}
                  enterKeyHint="search"
                  aria-label="커뮤니티 검색"
                  autoFocus
                />
                {query && (
                  <button type="button" className="csb-clear" onClick={() => { setQuery(""); searchInputRef.current?.focus(); }} aria-label="검색어 지우기">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button type="button" className="csb-cancel" onClick={closeSearch}>취소</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="community-layout">
        <aside className="community-filter-panel">
          <div className="community-filter-block">
            <CategoryChips
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={(id) => setSelectedGroupId(id)}
              stacked
              pending={!groupsReady && groups.length === 0}
              fadeIn={groupsFade}
            />
          </div>
        </aside>

        <section className="community-feed">
          {message && (
            <div className="community-message">
              {message}
            </div>
          )}

          {!selectedGroupId && !query.trim() && weeklyPosts.length > 0 && (
            <section className="weekly-popular" aria-label="주간 인기글" data-tour="com-weekly">
              <h2 className="weekly-popular-title" role="tablist" aria-label="게시글 보기">
                {/* 텍스트 탭 — 버튼 느낌 없이 글자만. 선택된 항목은 검정, 나머지는 회색. */}
                {([
                  { key: "", label: "주간 인기글" },
                  { key: "posts", label: "내가 쓴 글" },
                  { key: "comments", label: "내가 쓴 댓글" },
                ] as const).map((t) => {
                  const on = mineFilter === t.key;
                  return (
                    <button
                      key={t.key || "weekly"}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      className={`wp-tab${on ? " is-on" : ""}`}
                      onClick={() => (t.key ? toggleMineFilter(t.key) : setMineFilter(""))}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </h2>
              {!mineFilter && (
              <>
              <WeeklyCards posts={weeklyPosts} onOpen={openPost} />
              </>
              )}
            </section>
          )}

          <div className="community-post-list">
            {loading ? (
              <>
                <SkeletonPost />
                <SkeletonPost />
              </>
            ) : visiblePosts.length === 0 ? (
              <div style={emptyPanelStyle}>
                <p style={{ margin: 0, color: "var(--c-text-3)", fontSize: 14, fontWeight: 500 }}>
                  {activeMineFilter && meLoaded && !meId
                    ? "로그인하면 내 글과 댓글을 모아볼 수 있어요."
                    : activeMineFilter === "posts"
                      ? "내가 쓴 글이 아직 없어요."
                      : activeMineFilter === "comments"
                        ? (myCommentByPost === null ? "불러오는 중이에요." : "댓글을 남긴 글이 아직 없어요.")
                        : "아직 게시글이 없습니다."}
                </p>
              </div>
            ) : (
              visiblePosts.slice(0, renderCount).map((post, postIndex) => (
                <article
                  key={post.id}
                  className="community-post-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`${post.title} 상세 보기`}
                  onClick={() => openPost(post.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPost(post.id);
                    }
                  }}
                >
                  <div className="community-post-head" data-tour={postIndex === 0 ? "com-profile" : undefined}>
                    <div className="tc-ava-wrap is-link" onClick={(event) => openProfile(event, post.userId)}>
                      <div className="community-avatar" aria-hidden="true">
                        {post.authorIsAdmin ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/icons/stady-app-icon.svg" alt="" className="community-avatar-img" />
                        ) : post.avatar ? (
                          // 카톡 등 프로필 사진. 없으면 닉네임 첫 글자.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.avatar} alt="" className="community-avatar-photo" referrerPolicy="no-referrer" />
                        ) : (
                          post.nickname.slice(0, 1)
                        )}
                      </div>
                      {post.groupName && <span className="tc-role" style={{ background: boardTone(post.groupName).bg, color: boardTone(post.groupName).color }}>{boardShortName(post.groupName)}</span>}
                    </div>
                    <div className="tc-who is-link" onClick={(event) => openProfile(event, post.userId)}>
                      <p className="community-post-author" data-tour={postIndex === 0 ? "com-tier" : undefined}><span className="tc-name" style={{ backgroundImage: boardTone(post.groupName).ink }}>{post.nickname}</span><TierBadge tier={post.authorTier} /><KingBadges answer={post.authorIsAnswerKing} pick={post.authorIsPickKing} /></p>
                      <p className="community-post-date" title={formatExactTime(post.createdAt)}>
                        {formatRelativeTime(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <h2 className="community-post-title">
                    {post.type === "poll" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          marginRight: 6,
                          padding: "2px 8px 2px 5px",
                          borderRadius: 999,
                          background: "var(--c-brand-soft-4)",
                          color: "var(--c-brand-deep-2)",
                          fontSize: 12,
                          fontWeight: 600,
                          verticalAlign: "middle",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/icons/community/chart-vote.svg" alt="" width={14} height={14} style={{ display: "block" }} />
                        투표
                      </span>
                    )}
                    {post.type === "quiz" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          marginRight: 6,
                          padding: "2px 8px 2px 5px",
                          borderRadius: 999,
                          background: "var(--c-brand-soft-4)",
                          color: "var(--c-brand-deep-2)",
                          fontSize: 12,
                          fontWeight: 700,
                          verticalAlign: "middle",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/icons/community/ox-quiz.svg" alt="OX" width={15} height={15} style={{ display: "block" }} />
                        퀴즈
                      </span>
                    )}
                    {post.groupSlug === "qna" && <QBadge answered={post.commentCount > 0} />}
                    {post.title}
                  </h2>
                  <p className="community-post-content">{post.content}</p>
                  {post.type === "poll" && post.poll && post.poll.options.length > 0 && (
                    <FeedPoll
                      poll={post.poll}
                      voting={votingPostId === post.id}
                      onVote={(optionId) => votePoll(post.id, optionId)}
                    />
                  )}
                  {post.type === "quiz" && post.quiz && post.quiz.questions.length > 0 && (
                    <FeedQuiz
                      quiz={post.quiz}
                      busyQuestionId={answeringQuizId}
                      onAnswer={(questionId, answer) => answerQuiz(post.id, questionId, answer)}
                    />
                  )}
                  {post.imageUrls.length > 0 && (
                    <div className={post.imageUrls.length === 1 ? "community-post-image-single" : "community-post-image-grid"}>
                      {post.imageUrls.slice(0, 4).map((imageUrl, index) => (
                        <div key={imageUrl} className="community-post-image-thumb">
                          <img
                            src={imageUrl}
                            alt={post.isBlinded ? "스포일러 이미지" : `${post.title} 이미지 ${index + 1}`}
                            // 목록은 최신 100개 글을 한 번에 그리는데 화면에 보이는 건 두세 개뿐이다.
                            // lazy 가 없던 동안은 화면 밖 이미지까지 전부 즉시 받아서, 진입 1회에
                            // 실측 53.6MB 를 내려받았다(초기 뷰포트에 실제로 필요한 건 ~3MB).
                            // 썸네일 칸은 CSS 로 aspect-ratio 가 고정돼 있어 지연 로드해도 레이아웃이 밀리지 않는다.
                            // 화면에 처음 보이는 이미지가 LCP 후보다. lazy 는 프리로드 스캐너가
                            // 못 집어 시작이 늦으므로 그 한 장만 예외로 즉시 받는다.
                            // (맨 위 카드에 이미지가 없는 경우가 흔해서 "첫 카드"가 아니라
                            //  "이미지가 있는 첫 카드" 기준으로 잡는다.)
                            loading={postIndex === firstImagePostIndex && index === 0 ? "eager" : "lazy"}
                            fetchPriority={postIndex === firstImagePostIndex && index === 0 ? "high" : undefined}
                            decoding="async"
                            style={post.isBlinded && !revealedBlind.has(post.id) ? { filter: "blur(18px)", transform: "scale(1.05)" } : undefined}
                          />
                          {post.isBlinded && !revealedBlind.has(post.id) && (
                            <BlindNoiseCover
                              onReveal={() =>
                                setRevealedBlind((prev) => {
                                  const next = new Set(prev);
                                  next.add(post.id);
                                  return next;
                                })
                              }
                            />
                          )}
                          {index === 3 && post.imageUrls.length > 4 && !(post.isBlinded && !revealedBlind.has(post.id)) && (
                            <span>+{post.imageUrls.length - 4}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="community-post-tags">
                    {post.tags.map((tag) => (
                      <span key={tag.id} className="community-tag-badge">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                  {post.topComment && (
                    <div className="community-top-comment">
                      {post.topComment.pinned && (
                        <svg className="ctc-pin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          <path d="M12 15v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                      {!post.topComment.pinned && <CommentIcon />}
                      <span className="ctc-body">
                        <b>{post.topComment.nickname}</b> {post.topComment.content}
                      </span>
                      {post.commentCount > 1 && (
                        <span className="ctc-more">댓글 {post.commentCount}</span>
                      )}
                    </div>
                  )}
                  {(post.likeCount || 0) >= 3 && (post.likers?.length || 0) > 0 && (
                    <LikerStack likers={post.likers!} count={post.likeCount} />
                  )}
                  <div className="community-post-metrics">
                    <button
                      type="button"
                      className={`community-metric-btn${post.myReaction ? " is-liked" : ""}`}
                      aria-pressed={!!post.myReaction}
                      aria-label="좋아요"
                      disabled={likingPostId === post.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleLike(post);
                      }}
                    >
                      <TossHeartIcon filled={!!post.myReaction} />
                      <span>{formatCount(post.likeCount || 0)}</span>
                    </button>
                    <button
                      type="button"
                      className="community-metric-btn"
                      aria-label="댓글"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCommentModalPost(post);
                      }}
                    >
                      <TossCommentIcon />
                      <span>{formatCount(post.commentCount || 0)}</span>
                    </button>
                    <button
                      type="button"
                      className={`community-metric-btn${post.myReposted ? " is-reposted" : ""}`}
                      aria-label="리포스트"
                      aria-pressed={!!post.myReposted}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRepost(post);
                      }}
                    >
                      <TossRepostIcon />
                      {(post.repostCount || 0) > 0 && <span>{formatCount(post.repostCount || 0)}</span>}
                    </button>
                    <button
                      type="button"
                      className="community-metric-btn"
                      aria-label="공유"
                      onClick={(event) => {
                        event.stopPropagation();
                        sharePost(post);
                      }}
                    >
                      <TossShareIcon />
                    </button>
                    <span className="tc-more" onClick={(event) => event.stopPropagation()}>
                      <ReportBlockMenu
                        targetType="post"
                        postId={post.id}
                        targetUserId={post.userId}
                        targetNickname={post.nickname}
                        currentUserId={meId}
                        onBlocked={() => setPosts((prev) => prev.filter((p) => p.userId !== post.userId))}
                        variant="dots"
                      />
                    </span>
                  </div>
                </article>
              ))
            )}
            {!loading && visiblePosts.length > renderCount && <div ref={renderMoreRef} style={{ height: 1 }} aria-hidden="true" />}
          </div>
        </section>
      </div>

      {linkToast && <div className="community-link-toast" role="status">{linkToast}</div>}

      <div style={floatingWriteDockStyle}>
        <button
          type="button"
          className="community-floating-write"
          data-tour="com-write"
          onClick={() => setComposeOpen(true)}
          style={floatingWriteButtonStyle}
        >
          게시글 +
        </button>
      </div>
      <CommunityStyles />
      <CommunityTour />
      {/* 당겨서 새로고침 — 이모지가 통통 튀며 바뀐다(스피너 대신) */}
      <PullToRefresh
        offsetTop={topbarHeight}
        onRefresh={async () => {
          clientCache.clearPrefix("community-");
          await Promise.all([loadPosts(), loadWeeklyPopular()]);
        }}
      />

      {/* 넓은 화면 전용 상세 패널 — 목록을 그대로 둔 채 오른쪽을 덮는다.
          상세 화면 컴포넌트를 그대로 재사용하고, 그 안의 fixed 상단바만 패널 기준으로 눕힌다. */}
      {panelPostId && (
        <>
          <div
            className="community-panel-scrim"
            onClick={() => setPanelPostId(null)}
            aria-hidden="true"
          />
          <aside className="community-panel" role="dialog" aria-label="게시글 상세" aria-modal="false">
            <button
              type="button"
              className="community-panel-close press"
              onClick={() => setPanelPostId(null)}
              aria-label="상세 닫기"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
            <div className="community-panel-body">
              <CommunityPostDetailClient key={panelPostId} postId={panelPostId} />
            </div>
          </aside>
        </>
      )}

      {/* 스레드 스타일 글 작성 모달 */}
      {composeOpen && (
        <CommunityComposeModal
          initialContent={composePreset?.text}
          initialGroupSlug={composePreset?.group}
          onClose={() => { setComposeOpen(false); setComposePreset(null); }}
          onPosted={() => { setComposeOpen(false); setComposePreset(null); loadPosts(); loadWeeklyPopular(); }}
        />
      )}

      {/* 목록에서 바로 여는 댓글 모달(상세 진입 불필요) */}
      {commentModalPost && (
        <CommentModal
          post={commentModalPost}
          onClose={() => setCommentModalPost(null)}
          onCountChange={(delta) => bumpCommentCount(commentModalPost.id, delta)}
        />
      )}
    </main>
  );
}

// 주간 인기글 가로 카드 줄. 목록 전체가 아니라 이 컴포넌트만 다시 그려지도록 분리했다
// (카드가 바뀔 때마다 페이지 전체가 다시 그려지면 전환이 '딱딱' 끊긴다).
const WeeklyCards = memo(function WeeklyCards({ posts, onOpen }: { posts: CommunityPost[]; onOpen: (id: string) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const animRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const visibleRef = useRef(true);
  const touchedAtRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  // 카드 위치·여백을 미리 재서 두고 쓴다 — 스크롤 중 매 프레임 레이아웃/스타일을 읽으면 저사양 폰에서 끊긴다.
  const metricsRef = useRef<{ lefts: number[]; pad: number; max: number }>({ lefts: [], pad: 0, max: 0 });
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    metricsRef.current = {
      lefts: Array.from(track.children).map((c) => (c as HTMLElement).offsetLeft),
      pad,
      max: Math.max(0, track.scrollWidth - track.clientWidth),
    };
  }, []);

  const nearestIndex = (scrollLeft: number) => {
    const { lefts, pad } = metricsRef.current;
    const x = scrollLeft + pad;
    let best = 0;
    let min = Infinity;
    for (let i = 0; i < lefts.length; i++) {
      const d = Math.abs(lefts[i] - x);
      if (d < min) { min = d; best = i; }
    }
    return best;
  };

  // 손으로 넘길 때 현재 카드 표시 갱신 — 프레임당 한 번, DOM 은 scrollLeft 하나만 읽는다. 자동 전환 중엔 목표 카드를 미리 켜 두므로 건너뛴다.
  function handleScroll() {
    if (animatingRef.current || scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const next = nearestIndex(track.scrollLeft);
      setActive((cur) => (cur === next ? cur : next));
    });
  }

  function finishAnim() {
    animatingRef.current = false;
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    if (trackRef.current) trackRef.current.style.scrollSnapType = "";
  }

  // 자동 전환. 브라우저 기본 smooth 스크롤을 쓴다(합성 스레드에서 돌아 자바스크립트가 바빠도 끊기지 않는다).
  // 도는 동안만 scroll-snap 을 꺼서 스냅이 끼어들지 않게 하고, 끝나면 되돌린다(이미 스냅 위치라 튀지 않는다).
  // smooth 를 못 쓰는 구형 WebView 는 이징 스크롤로 대신한다.
  function animateTo(track: HTMLElement, target: number) {
    finishAnim();
    const from = track.scrollLeft;
    const dist = target - from;
    if (Math.abs(dist) < 1) return;
    animatingRef.current = true;
    setActive(nearestIndex(target)); // 목표 카드를 먼저 밝힌다(불투명도 전환은 합성만 한다)
    track.style.scrollSnapType = "none";
    const nativeSmooth = typeof document !== "undefined" && "scrollBehavior" in document.documentElement.style;
    if (nativeSmooth) {
      track.scrollTo({ left: target, behavior: "smooth" });
      snapTimerRef.current = window.setTimeout(() => {
        snapTimerRef.current = null;
        finishAnim();
        // 실제 스크롤 위치에 맞춰 현재 카드를 다시 맞춘다(스크롤이 막힌 환경에서도 어긋나지 않게)
        if (trackRef.current) {
          const next = nearestIndex(trackRef.current.scrollLeft);
          setActive((cur) => (cur === next ? cur : next));
        }
      }, 1000);
      return;
    }
    const DURATION = 1100;
    const t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      track.scrollLeft = from + dist * ease(t);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else finishAnim();
    };
    animRef.current = requestAnimationFrame(tick);
  }

  function onTouch() {
    touchedAtRef.current = Date.now();
    // 자동 전환 중에 손이 닿으면 즉시 멈춘다(smooth 스크롤도 제자리에서 끊는다)
    if (animatingRef.current && trackRef.current) {
      trackRef.current.scrollTo({ left: trackRef.current.scrollLeft, behavior: "instant" as ScrollBehavior });
    }
    finishAnim();
  }

  // 위치 미리 재기(마운트·크기 변화·카드 수 변화)
  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    return () => ro.disconnect();
  }, [posts.length, measure]);

  // 화면 밖이면 자동 전환을 쉰다(안 보이는 곳에서 스크롤 일을 하지 않는다)
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting; });
    io.observe(track);
    return () => io.disconnect();
  }, []);

  // 3.2초마다 자동 전환. 끝에 닿으면 방향을 뒤집어(핑퐁) 순환.
  // 방향 전환 기준은 카드 '인덱스'가 아니라 실제 스크롤 경계(maxScroll·0)다(태블릿에서 마지막 카드가 왼쪽 끝에 못 붙는 문제).
  useEffect(() => {
    if (posts.length <= 1) return;
    const EPS = 4;
    let dir: 1 | -1 = 1;
    const targetFor = (cur: number, d: 1 | -1) => {
      const { lefts, pad, max } = metricsRef.current;
      const idx = Math.max(0, Math.min(lefts.length - 1, cur + d));
      return Math.max(0, Math.min(max, lefts[idx] - pad));
    };
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      if (document.hidden || !visibleRef.current) return;
      if (animatingRef.current) return;
      if (Date.now() - touchedAtRef.current < 4500) return;
      const { lefts, max } = metricsRef.current;
      if (lefts.length <= 1) return;
      const left = track.scrollLeft;
      if (dir === 1 && left >= max - EPS) dir = -1;
      else if (dir === -1 && left <= EPS) dir = 1;
      const cur = nearestIndex(left);
      let target = targetFor(cur, dir);
      // 클램프로 제자리면(경계에서 더 못 감) 방향을 뒤집어 반대편 카드로 간다 — 멈춤 방지.
      if (Math.abs(target - left) < EPS) {
        dir = dir === 1 ? -1 : 1;
        target = targetFor(cur, dir);
        if (Math.abs(target - left) < EPS) return;
      }
      animateTo(track, target);
    }, 3200);
    return () => {
      window.clearInterval(id);
      finishAnim();
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  return (
    <>
      <div className="weekly-popular-viewport">
        <div
          className="weekly-popular-track"
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={onTouch}
          onTouchStart={onTouch}
          onWheel={onTouch}
        >
          {posts.map((post, index) => (
            <button
              key={post.id}
              type="button"
              className="weekly-popular-card"
              onClick={() => onOpenRef.current(post.id)}
              // 비활성 카드는 '축소'가 아니라 '흐리게'로 구분한다(scale 은 슬라이드 중 좌측이 잘려 보였다).
              style={{ opacity: index === active ? 1 : 0.55 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="weekly-popular-medal"
                src={`/icons/community/medal-${Math.min(index + 1, 5)}.svg`}
                alt={`${index + 1}위`}
                width={44}
                height={44}
              />
              <span className="weekly-popular-top">
                <span className="weekly-popular-group">{post.groupName}</span>
              </span>
              <span className="weekly-popular-card-title">{post.title}</span>
              <span className="weekly-popular-card-content">{post.content}</span>
              <span className="weekly-popular-card-metrics">
                <span><HeartIcon /> {post.likeCount || 0}</span>
                <span><CommentIcon /> {post.commentCount || 0}</span>
                <span><EyeIcon /> {post.viewCount || 0}</span>
              </span>
            </button>
          ))}
        </div>
        {/* 양끝이 스르륵 사라지는 가장자리 — 스크롤 영역에 마스크를 씌우면 매 프레임 다시 칠해져 끊기므로 위에 얹는 가벼운 오버레이로 */}
        <div className="weekly-fade weekly-fade-l" aria-hidden="true" />
        <div className="weekly-fade weekly-fade-r" aria-hidden="true" />
      </div>
      {posts.length > 1 && (
        <div className="weekly-popular-dots" aria-hidden="true">
          {posts.map((post, index) => (
            <span key={post.id} className={index === active ? "weekly-dot active" : "weekly-dot"} />
          ))}
        </div>
      )}
    </>
  );
});

// 카테고리 이름별 아이콘(public/icons/cg-*.svg). 활성 칩은 배경이 어두워서
// 흰색(-on) 버전을 쓴다. 표에 없는 새 카테고리는 태그 아이콘으로 대체.
const GROUP_ICONS: Record<string, string> = {
  자유: "cg-free",
  입시: "cg-admission",
  질문게시판: "cg-question",
  공지: "cg-notice",
  건의게시판: "cg-suggest",
  대학: "cg-college",
};
function groupIcon(name: string): string {
  return GROUP_ICONS[name.trim()] ?? "cg-etc";
}

// 좋아요 3명 이상일 때 누른 사람 프로필을 겹쳐 보여준다(사진 없으면 첫 글자).
function LikerStack({ likers, count }: { likers: Liker[]; count: number }) {
  const show = likers.slice(0, 4);
  return (
    <div className="liker-stack" aria-label={`${count}명이 좋아요`}>
      <span className="liker-avatars">
        {show.map((u, i) => (
          <span key={u.userId} className="liker-av" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: show.length - i }}>
            {u.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="liker-letter">{u.nickname.slice(0, 1)}</span>
            )}
          </span>
        ))}
      </span>
      <span className="liker-count">{count}명이 좋아요를 눌렀어요</span>
    </div>
  );
}

function CategoryChips({
  groups,
  selectedGroupId,
  onSelect,
  stacked = false,
  pending = false,
  fadeIn = false,
}: {
  groups: CategoryGroup[];
  selectedGroupId: string;
  onSelect: (id: string) => void;
  stacked?: boolean;
  /** 카테고리를 아직 못 받음 — 자리표시 탭을 그린다 */
  pending?: boolean;
  /** 받은 뒤 새로 생긴 탭을 살며시 나타나게 */
  fadeIn?: boolean;
}) {
  const items = [{ id: "", name: "전체", icon: "cg-all" }, ...groups.map((g) => ({ id: g.id, name: g.name, icon: groupIcon(g.name) }))];
  // 가로로 더 볼 게 남았을 때만 우측을 페이드한다(끝까지 밀면 마지막 탭이 흐려지지 않게).
  const railRef = useRef<HTMLElement | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  return (
    <nav
      ref={railRef}
      className={`tabrail${stacked ? " is-stacked" : ""}${atEnd ? " is-end" : ""}`}
      aria-label="커뮤니티 카테고리"
      data-tour="com-cats"
    >
      {items.map((it, i) => {
        const on = selectedGroupId === it.id;
        return (
          <button
            key={it.id || "all"}
            type="button"
            className={`tabrail-item${on ? " is-on" : ""}${fadeIn && i > 0 ? " is-fade" : ""}`}
            style={fadeIn && i > 0 ? { animationDelay: `${Math.min(i, 8) * 45}ms` } : undefined}
            onClick={() => onSelect(it.id)}
            aria-current={on ? "true" : undefined}
          >
            <span className="tabrail-ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/icons/${it.icon}${on ? "-on" : ""}.svg`} alt="" width={24} height={24} />
            </span>
            <span className="tabrail-label">{it.name}</span>
          </button>
        );
      })}
      {pending &&
        [0, 1, 2, 3, 4].map((n) => (
          <span key={`ph${n}`} className="tabrail-item tabrail-ph" aria-hidden="true">
            <span className="tabrail-ico" />
            <span className="tabrail-label" />
          </span>
        ))}
    </nav>
  );
}

function SkeletonPost() {
  return (
    <div className="community-post-card community-skeleton-card" aria-hidden="true">
      <div className="community-skeleton-line" style={{ width: "38%" }} />
      <div className="community-skeleton-line" style={{ width: "72%", height: 18 }} />
      <div className="community-skeleton-line" style={{ width: "100%" }} />
      <div className="community-skeleton-line" style={{ width: "58%" }} />
    </div>
  );
}

// 아이콘은 사용자가 준 토스 mono 세트(채움형). 색은 currentColor 로 둬서
// 옆 수치 텍스트 색·다크모드를 그대로 따라간다.
function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.9038 21.2884C11.5698 21.7284 12.4288 21.7284 13.0938 21.2884C15.2088 19.8924 19.8138 16.5554 21.7978 12.8214C24.4128 7.89542 21.3418 2.98242 17.2818 2.98242C14.9678 2.98242 13.5758 4.19142 12.8058 5.23042C12.4818 5.67542 11.8588 5.77442 11.4128 5.45042C11.3278 5.38942 11.2538 5.31442 11.1928 5.23042C10.4228 4.19142 9.03076 2.98242 6.71676 2.98242C2.65676 2.98242 -0.414244 7.89542 2.20176 12.8214C4.18376 16.5554 8.79076 19.8924 10.9038 21.2884Z" fill="currentColor" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.0001 2C6.42809 2 1.91309 6.131 1.91309 11.126C1.91309 13.528 2.97009 15.737 4.69909 17.37L3.83409 21.405C3.73809 21.789 4.12209 22.077 4.50609 21.981L9.02109 19.868C9.98209 20.156 10.9421 20.252 11.9991 20.252C17.5711 20.252 22.0861 16.121 22.0861 11.126C22.0861 6.131 17.5721 2 12.0001 2Z" fill="currentColor" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.1251 9.22461C10.5251 9.22461 9.2251 10.5246 9.2251 12.1246C9.2251 13.7246 10.5251 15.0246 12.1251 15.0246C13.7251 15.0246 15.0251 13.7246 15.0251 12.1246C15.0251 10.5246 13.7251 9.22461 12.1251 9.22461Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12.125 17.1248C9.325 17.1248 7.125 14.8248 7.125 12.1248C7.125 9.4248 9.425 7.1248 12.125 7.1248C14.825 7.1248 17.125 9.4248 17.125 12.1248C17.125 14.8248 14.925 17.1248 12.125 17.1248ZM23.125 10.8248C20.525 6.8248 16.425 4.4248 12.125 4.4248C7.825 4.4248 3.725 6.8248 1.125 10.8248C0.625 11.6248 0.625 12.6248 1.125 13.4248C3.725 17.4248 7.825 19.8248 12.125 19.8248C16.425 19.8248 20.525 17.4248 23.125 13.4248C23.725 12.6248 23.725 11.6248 23.125 10.8248Z" fill="currentColor" />
    </svg>
  );
}

// O / X 표시는 글자가 아니라 도형으로 그린다(폰트에 따라 모양이 달라지지 않게).
function OXMark({ o, size = 20 }: { o: boolean; size?: number }) {
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

// 목록 인라인 OX 퀴즈 — 문제마다 O / X 버튼. 고르면 바로 정답·오답과 응답 비율이 보인다.
// 한 번 고른 답은 못 바꾼다(서버도 같은 규칙). 카드 클릭(상세 이동)으로 번지지 않게 막는다.
function FeedQuiz({
  quiz,
  busyQuestionId,
  onAnswer,
}: {
  quiz: CommunityQuiz;
  busyQuestionId: string | null;
  onAnswer: (questionId: string, answer: boolean) => void;
}) {
  const total = quiz.questions.length;
  return (
    <div
      className="feed-quiz"
      role="group"
      aria-label="OX 퀴즈"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ display: "grid", gap: 8, margin: "2px 0" }}
    >
      {quiz.questions.map((q) => {
        const solved = q.myAnswer !== null;
        const correct = solved && q.myAnswer === q.correctAnswer;
        const answers = q.oCount + q.xCount;
        return (
          <div
            key={q.id}
            style={{
              display: "grid",
              gap: 8,
              padding: "2px 0",
            }}
          >
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: "var(--c-text-2e)", lineHeight: 1.45 }}>
              {q.text}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {([true, false] as const).map((val) => {
                const picked = q.myAnswer === val;
                const isAnswer = solved && q.correctAnswer === val;
                const pct = answers > 0 ? Math.round(((val ? q.oCount : q.xCount) / answers) * 100) : 0;
                return (
                  <button
                    key={String(val)}
                    type="button"
                    className="press"
                    disabled={solved || busyQuestionId === q.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAnswer(q.id, val);
                    }}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      // O / X 칸은 정사각(1:1)
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      border: "none",
                      // 정답 칸은 그 칸의 색으로 테두리를 두르고, 내가 고른 오답은 흐리게 둔다.
                      boxShadow: isAnswer
                        ? `inset 0 0 0 2px ${val ? "var(--c-quiz-o-line)" : "var(--c-quiz-x-line)"}`
                        : "none",
                      background: val ? "var(--c-quiz-o-soft)" : "var(--c-quiz-x-soft)",
                      color: val ? "var(--c-quiz-o)" : "var(--c-quiz-x)",
                      opacity: solved && !isAnswer ? (picked ? 0.55 : 0.32) : 1,
                      fontSize: 17,
                      fontWeight: 700,
                      cursor: solved ? "default" : "pointer",
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <OXMark o={val} size={20} />
                  </button>
                );
              })}
              {solved ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: correct ? "var(--c-quiz-o)" : "var(--c-quiz-x)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={correct ? "/icons/emoji/quiz-correct.svg" : "/icons/emoji/quiz-wrong.svg"}
                      alt=""
                      width={17}
                      height={17}
                      style={{ display: "block" }}
                    />
                    {correct ? "정답!" : "오답"}
                  </span>
                  <span style={{ color: "var(--c-text-4c)", fontWeight: 600 }}>
                    O {answers > 0 ? Math.round((q.oCount / answers) * 100) : 0}% · X{" "}
                    {answers > 0 ? Math.round((q.xCount / answers) * 100) : 0}%
                  </span>
                </span>
              ) : (
                <span style={{ fontSize: 12.5, color: "var(--c-text-4c)", fontWeight: 600 }}>O 또는 X를 골라보세요</span>
              )}
            </div>
          </div>
        );
      })}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-text-4c)", fontWeight: 700 }}>
        {quiz.solvedCount > 0
          ? `${total}문제 중 ${quiz.solvedCount}문제 풀이 · ${quiz.correctCount}개 정답`
          : `${total}문제 · ${quiz.participantCount}명 참여`}
      </p>
    </div>
  );
}

// 목록 인라인 투표 카드 — 데일리 퀴즈 옵션 톤(둥근 면 + 결과 채움 바).
// 투표 전엔 깔끔한 선택지, 투표 후엔 퍼센트 바 + 내 선택 강조(체크). 상세 진입 불필요.
function FeedPoll({
  poll,
  voting,
  onVote,
}: {
  poll: CommunityPoll;
  voting: boolean;
  onVote: (optionId: string) => void;
}) {
  const voted = poll.myOptionId !== null;
  const total = poll.totalVotes;
  return (
    <div
      className="feed-poll"
      role="group"
      aria-label="투표"
      // 카드 클릭(상세 이동)으로 번지지 않게 막는다 — 여기선 투표만.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ display: "grid", gap: 7, margin: "2px 0" }}
    >
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const mine = poll.myOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            className="feed-poll-option press"
            disabled={voting}
            onClick={(event) => {
              event.stopPropagation();
              onVote(opt.id);
            }}
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              minHeight: 46,
              padding: "0 14px",
              borderRadius: 14,
              border: "none",
              boxShadow: mine ? "inset 0 0 0 2px var(--c-brand)" : "none",
              background: voted ? "var(--c-bg-soft-12)" : "var(--c-bg-muted-13)",
              color: "var(--c-text-2e)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "left",
              cursor: voting ? "default" : "pointer",
            }}
          >
            {voted && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${pct}%`,
                  background: mine ? "var(--c-brand-line-2)" : "var(--c-bg-muted)",
                  transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            )}
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {mine && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/icons/community/check.svg" alt="" width={16} height={16} style={{ display: "block", flexShrink: 0 }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.text}</span>
            </span>
            {voted && (
              <span
                style={{
                  position: "relative",
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: mine ? "var(--c-brand-deep-2)" : "var(--c-text-4)",
                }}
              >
                {pct}%
              </span>
            )}
          </button>
        );
      })}
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-4)", paddingLeft: 2 }}>
        {voted ? `총 ${total}표 · 다시 누르면 변경` : "눌러서 바로 투표"}
      </span>
    </div>
  );
}

interface FeedComment {
  id: string;
  userId: string | null;
  parentId: string | null;
  nickname: string;
  avatar?: string | null;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: FeedComment[];
}

// 댓글 정렬 옵션(백엔드 CommentSort 와 키 일치).
const COMMENT_SORTS = [
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" },
  { key: "popular", label: "인기순" },
  { key: "recommended", label: "추천순" },
] as const;
type CommentSortKey = (typeof COMMENT_SORTS)[number]["key"];

function countComments(list: FeedComment[]): number {
  return list.reduce((sum, c) => sum + 1 + countComments(c.replies || []), 0);
}

function CommentRow({
  c,
  depth = 0,
  meId,
  activeReplyId,
  onEdit,
  onDelete,
  onToggleLike,
  onReply,
  onBlocked,
}: {
  c: FeedComment;
  depth?: number;
  meId: string | null;
  activeReplyId: string;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleLike: (id: string) => void;
  onReply: (c: FeedComment) => void;
  onBlocked: () => void;
}) {
  const router = useRouter();
  const mine = !!meId && c.userId === meId;
  const goProfile = () => { if (c.userId) router.push(`/community/user/${c.userId}`); };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.content);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveEdit() {
    const next = draft.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      await onEdit(c.id, next);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }
  async function doDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete(c.id);
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  }

  return (
    <div className={`ccs-c${depth > 0 ? " is-reply" : ""}${activeReplyId === c.id ? " is-active" : ""}`}>
      <span className={`ccs-av${depth > 0 ? " is-sm" : ""}`} aria-hidden="true" onClick={goProfile} style={{ cursor: c.userId ? "pointer" : undefined }}>
        {c.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          c.nickname.slice(0, 1)
        )}
      </span>
      <div className="ccs-c-main">
        <div className="ccs-item">
          <span className="ccs-name" onClick={goProfile} style={{ cursor: c.userId ? "pointer" : undefined }}>{c.nickname}</span>
          <span className="ccs-time" title={formatExactTime(c.createdAt)}>· {formatRelativeTime(c.createdAt)}</span>
        </div>
        {editing ? (
          <div className="ccs-editbox">
            <textarea
              className="ccs-edit"
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px"; }}
              aria-label="댓글 수정"
              autoFocus
            />
            <div className="ccs-editbtns">
              <button type="button" className="ccs-action" onClick={() => setEditing(false)} disabled={busy}>취소</button>
              <button type="button" className="ccs-action is-primary" onClick={saveEdit} disabled={busy || !draft.trim()}>{busy ? "저장 중…" : "저장"}</button>
            </div>
          </div>
        ) : (
          <p className="ccs-content">{renderWithMention(c.content)}</p>
        )}
        {confirmDel && (
          // 인앱 확인 — 안드로이드 WebView 는 window.confirm 이 동작하지 않는다.
          <div className="ccs-confirm">
            <span>댓글을 삭제할까요?</span>
            <button type="button" className="ccs-action" onClick={() => setConfirmDel(false)} disabled={busy}>취소</button>
            <button type="button" className="ccs-action is-danger" onClick={doDelete} disabled={busy}>{busy ? "삭제 중…" : "삭제"}</button>
          </div>
        )}
        {!editing && !confirmDel && (
          <div className="ccs-c-acts">
            <button type="button" className={`ccs-like${c.likedByMe ? " is-liked" : ""}`} aria-label="공감" aria-pressed={c.likedByMe} onClick={() => onToggleLike(c.id)}>
              <TossHeartIcon filled={c.likedByMe} />
              {c.likeCount > 0 && <span>{formatCount(c.likeCount)}</span>}
            </button>
            <button type="button" className="ccs-reply" onClick={() => onReply(c)}>
              <ReplyArrowIcon />
              답글 달기
            </button>
            {mine && (
              <>
                <button type="button" className="ccs-action" onClick={() => { setDraft(c.content); setEditing(true); }}>수정</button>
                <button type="button" className="ccs-action is-danger-soft" onClick={() => setConfirmDel(true)}>삭제</button>
              </>
            )}
            <span className="ccs-more">
              <ReportBlockMenu
                targetType="comment"
                commentId={c.id}
                targetUserId={c.userId}
                targetNickname={c.nickname}
                currentUserId={meId}
                onBlocked={onBlocked}
                variant="dots"
              />
            </span>
          </div>
        )}
        {(c.replies || []).length > 0 && (
          <div className="ccs-replies">
            {c.replies.map((r) => (
              <CommentRow
                key={r.id}
                c={r}
                depth={depth + 1}
                meId={meId}
                activeReplyId={activeReplyId}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleLike={onToggleLike}
                onReply={onReply}
                onBlocked={onBlocked}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function updateFeedComment(list: FeedComment[], id: string, fn: (c: FeedComment) => FeedComment): FeedComment[] {
  return list.map((c) => (c.id === id ? fn(c) : { ...c, replies: updateFeedComment(c.replies || [], id, fn) }));
}

// 목록에서 상세 진입 없이 여는 댓글 모달(바텀시트) — 글 상세와 같은 토스 톤. 스프링으로 올라오고, 내려가며 닫히고, 아래로 끌어 닫는다.
function CommentModal({
  post,
  onClose,
  onCountChange,
}: {
  post: CommunityPost;
  onClose: () => void;
  onCountChange: (delta: number) => void; // 카드의 댓글 수 갱신(+1 등록, -1 삭제)
}) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState("");
  const [sort, setSort] = useState<CommentSortKey>("popular");
  const [sortOpen, setSortOpen] = useState(false);
  const [me, setMe] = useState<{ id: string; nickname: string; avatar: string | null } | null>(null);
  const meId = me?.id ?? null;
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 안드로이드 WebView 는 키보드가 떠도 fixed 기준 화면을 줄이지 않아 입력창이 키보드 뒤로 숨는다.
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const keyboardInset = useKeyboardInset(true, overlayRef);
  // 뒤 화면 스크롤 잠금 + 닫을 때 '뚝' 사라지지 않고 내려가는 연출(공용 모달과 같은 규칙)
  useBodyScrollLock(true);
  const { leaving, exit } = useModalExit();
  const [dragged, setDragged] = useState(false);
  const close = () => exit(onClose);

  // 내 댓글에만 수정·삭제를 보이고, 입력창 옆에 내 프로필을 보이기 위해 내 정보를 받는다.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.user) setMe({ id: d.user.id, nickname: d.user.nickname ?? "나", avatar: d.user.avatar ?? null });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function editComment(id: string, content: string) {
    setMsg("");
    const res = await fetch(`/api/community/comments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || "댓글을 수정하지 못했습니다."); throw new Error("edit failed"); }
    await load();
  }

  async function deleteComment(id: string) {
    setMsg("");
    const res = await fetch(`/api/community/comments/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || "댓글을 삭제하지 못했습니다."); return; }
    onCountChange(-1);
    await load();
  }

  async function toggleCommentLike(id: string) {
    setMsg("");
    try {
      const res = await fetch(`/api/community/comments/${encodeURIComponent(id)}/like`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "공감을 처리하지 못했습니다.");
      setComments((cur) => updateFeedComment(cur, id, (c) => ({ ...c, likedByMe: !!data.liked, likeCount: data.likeCount ?? c.likeCount })));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "공감을 처리하지 못했습니다.");
    }
  }

  async function load(s: CommentSortKey = sort) {
    try {
      const res = await fetch(
        `/api/community/posts/${encodeURIComponent(post.id)}/comments?sort=${s}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch {
      /* 댓글을 못 받아도 모달은 열어둔다(작성은 가능) */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, sort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exit(onClose); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, exit]);

  async function submit() {
    const typed = text.trim();
    if (!typed || posting) return;
    // 답글이면 '@닉네임 ' 을 앞에 붙여 저장한다(상세와 같은 규칙).
    const content = replyTo ? `@${replyTo.nickname} ${typed}` : typed;
    setPosting(true);
    setMsg("");
    try {
      const res = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyTo ? { content, parentId: replyTo.id } : { content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "댓글을 저장하지 못했습니다.");
      setText("");
      setReplyTo(null);
      onCountChange(1);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setPosting(false);
    }
  }

  function startReply(c: FeedComment) {
    setReplyTo({ id: c.id, nickname: c.nickname });
    setText("");
    inputRef.current?.focus();
  }

  // 이모지 줄을 누르면 입력칸의 커서 자리에 넣는다.
  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(caret, caret); } catch { /* 일부 WebView 는 지원 안 함 */ }
    });
  }

  // 위쪽 손잡이 영역을 아래로 끌어 닫기(좁은 화면 바텀시트에서만). 손가락을 따라 내려오고, 충분히 내렸거나 빠르게 밀면 닫힌다.
  const dragRef = useRef<{ y: number; t: number; id: number } | null>(null);
  function onGrabDown(e: React.PointerEvent<HTMLDivElement>) {
    if (window.innerWidth >= 720) return;
    dragRef.current = { y: e.clientY, t: Date.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transition = "none";
  }
  function onGrabMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const dy = Math.max(0, e.clientY - d.y);
    sheet.style.transform = `translateY(${dy}px)`;
  }
  function onGrabUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const sheet = sheetRef.current;
    dragRef.current = null;
    if (!d || !sheet) return;
    const dy = Math.max(0, e.clientY - d.y);
    const speed = dy / Math.max(1, Date.now() - d.t); // px/ms
    if (dy > 110 || (dy > 40 && speed > 0.6)) {
      // 끌어 내린 자리에서 이어서 내려가 닫는다(처음 위치로 튀지 않게 키프레임 대신 transition).
      setDragged(true);
      sheet.style.transition = "transform 0.22s cubic-bezier(0.4, 0, 1, 1)";
      sheet.style.transform = "translateY(100%)";
      exit(onClose);
    } else {
      sheet.style.transition = "transform 0.42s cubic-bezier(0.22, 1.25, 0.36, 1)";
      sheet.style.transform = "";
    }
  }

  const total = countComments(comments);

  return (
    <div
      ref={overlayRef}
      className={`community-comment-modal${leaving ? " is-leaving" : ""}${dragged ? " is-dragged" : ""}`}
      style={{ paddingBottom: keyboardInset }}
      onClick={close}
    >
      {/* 키보드가 뜨면 남은 영역을 꽉 채운다 — 고정 높이로 두면 입력창이 시트 밖으로 밀려 잘린다. */}
      <div
        ref={sheetRef}
        className="community-comment-sheet"
        style={keyboardInset > 0 ? { height: "100%" } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="댓글"
      >
        <div className="ccs-grab" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp}>
          <span className="ccs-handle" aria-hidden="true" />
          <div className="ccs-head">
            <p className="ccs-title">댓글 {total}</p>
            <button type="button" className="ccs-close" onClick={close} onPointerDown={(e) => e.stopPropagation()} aria-label="닫기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="ccs-sortwrap">
          <button type="button" className="ccs-sortbtn" aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen((v) => !v)}>
            {COMMENT_SORTS.find((x) => x.key === sort)?.label}
            <SortArrowsIcon />
          </button>
          {sortOpen && (
            <>
              <div className="ccs-sort-backdrop" onClick={() => setSortOpen(false)} />
              <div className="ccs-sort-menu" role="listbox">
                {COMMENT_SORTS.map((x) => (
                  <button
                    key={x.key}
                    type="button"
                    role="option"
                    aria-selected={sort === x.key}
                    className={`ccs-sort-item${sort === x.key ? " on" : ""}`}
                    onClick={() => { setSortOpen(false); setSort(x.key); }}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ccs-list">
          {loading ? (
            <p className="ccs-empty">불러오는 중이에요.</p>
          ) : comments.length === 0 ? (
            <div className="ccs-empty ccs-empty-sleep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/toss/sleeping.svg" alt="" width={44} height={44} />
              <p>댓글이 자고있나봐요<br />깨워주세요!</p>
            </div>
          ) : (
            comments.map((c) => (
              <CommentRow
                key={c.id}
                c={c}
                meId={meId}
                activeReplyId={replyTo?.id ?? ""}
                onEdit={editComment}
                onDelete={deleteComment}
                onToggleLike={toggleCommentLike}
                onReply={startReply}
                onBlocked={() => load()}
              />
            ))
          )}
        </div>
        {msg && <p className="ccs-msg">{msg}</p>}
        <div className="ccs-dock">
          <EmojiBar className="ccs-react-bar" onPick={insertEmoji} />
          <form className="ccs-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <span className="ccs-av is-me" aria-hidden="true">
              {me?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                (me?.nickname ?? "나").slice(0, 1)
              )}
            </span>
            <div className="ccs-bar">
              {replyTo && (
                <button type="button" className="ccs-mention" onClick={() => setReplyTo(null)} aria-label={`${replyTo.nickname}님 답글 취소`}>
                  @{replyTo.nickname}
                </button>
              )}
              <input
                ref={inputRef}
                className="ccs-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyTo ? "" : "댓글로 의견을 남겨보세요"}
                enterKeyHint="send"
                aria-label={replyTo ? `${replyTo.nickname}님에게 답글` : "댓글 입력"}
              />
              <button type="submit" className="ccs-send" disabled={posting || !text.trim()} aria-label="등록">
                <SendUpIcon />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CommunityStyles() {
  return (
    <style>{`
      /* ── 넓은 화면 상세 패널 ─────────────────────────────────
         목록을 그대로 둔 채 오른쪽 38% 를 덮는다. 1024px 미만에서는 아예 쓰지 않는다
         (openPost 가 그 폭에서는 기존처럼 상세 페이지로 보낸다). */
      .community-panel-scrim {
        position: fixed;
        inset: 0;
        z-index: 90;
        background: rgba(15, 23, 42, 0.28);
        animation: communityPanelFade 0.18s ease;
      }
      .community-panel {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 91;
        width: 38%;
        min-width: 420px;
        height: 100vh;
        background: var(--c-bg);
        border-left: 1px solid var(--c-border);
        box-shadow: -18px 0 44px rgba(15, 23, 42, 0.16);
        display: flex;
        flex-direction: column;
        animation: communityPanelIn 0.24s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .community-panel-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      /* 상세 화면의 상단바는 뷰포트 기준 fixed(폭 720px)라 그대로 두면 패널 밖으로 삐져나간다.
         패널 안에서는 흐름 위에 얹히는 sticky 로 눕힌다. */
      .community-panel .community-detail-topbar {
        position: sticky;
        top: 0;
        width: 100%;
        max-width: none;
        left: auto;
        transform: none;
      }
      /* 상세가 페이지 단독일 때 쓰는 상단 여백은 패널 안에서 불필요하다. */
      .community-panel .community-detail-page {
        padding-top: 0;
        min-height: 0;
      }
      /* 상세 화면의 shell 은 '화면에 고정된 헤더' 자리를 비워두려고 padding-top 을 갖고 있다.
         패널 안에서는 헤더를 sticky(문서 흐름 안)로 눕혔으므로 그 여백이 그대로 남으면
         헤더 아래에 빈 줄이 하나 더 생겨 헤더가 두 개처럼 보인다 → 여백을 걷어낸다. */
      .community-panel .community-detail-shell {
        padding-top: 0;
      }
      /* 상세 하단 고정 입력창(.cpd-dock)은 뷰포트 기준 fixed 라 패널 밖으로 나온다 →
         패널 안에서는 스크롤 칸 맨 아래에 붙는 sticky 로 바꾼다. */
      .community-panel .cpd-dock-overlay {
        position: sticky;
        top: auto;
        right: auto;
        left: auto;
        bottom: 0;
        z-index: 5;
        pointer-events: auto;
      }
      .community-panel .cpd-dock {
        position: static;
        transform: none;
        width: 100%;
      }
      .community-panel .community-detail-page {
        padding-bottom: 0;
        flex: 1 0 auto;
        display: flex;
        flex-direction: column;
      }
      .community-panel .community-detail-shell {
        flex: 1 0 auto;
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      .community-panel .cpd-dock-overlay {
        margin-top: auto;
      }
      .community-panel-close {
        position: absolute;
        top: 10px;
        right: 12px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: none;
        background: var(--c-bg-muted);
        color: var(--c-text-3);
        cursor: pointer;
      }
      @keyframes communityPanelIn {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes communityPanelFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .community-panel, .community-panel-scrim { animation: none; }
      }

      .community-page {
        min-height: 100vh;
        background: var(--c-bg);
        color: var(--c-text);
        padding-top: var(--community-header-height, 0px);
        padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px));
      }
      .community-topbar {
        position: fixed;
        top: 0;
        left: 50%;
        z-index: 80;
        width: min(100vw, 720px);
        max-width: 720px;
        box-sizing: border-box;
        display: grid;
        gap: 12px;
        transform: translateX(-50%);
        /* 맨 위에서는 배경·보더가 없다. 스크롤을 내리면 아래로 옅어지는 그라데이션이 스르륵 나온다. */
        background: transparent;
        padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 8px;
      }
      .community-topbar::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: calc(100% + 22px);
        z-index: -1;
        background: linear-gradient(to bottom, var(--c-bg) 0%, var(--c-bg) 55%, transparent 100%);
        opacity: 0;
        transition: opacity 0.28s ease;
        pointer-events: none;
      }
      .community-topbar.is-scrolled::before { opacity: 1; }
      /* 카테고리 탭: 아이콘 옆에 글자(16px, 얇게). 스크롤로 접히거나 움직이지 않는다. */
      .community-topbar .tabrail { gap: 4px; padding: 0; align-items: center; }
      .community-topbar .tabrail-item {
        flex-direction: row;
        align-items: center;
        gap: 6px;
        width: auto;
        height: 44px;
        padding: 0 14px 0 8px;
        border-radius: 14px;
      }
      .community-topbar .tabrail-ico { flex: none; width: 30px; height: 30px; border-radius: 10px; }
      .community-topbar .tabrail-ico img { width: 22px; height: 22px; }
      .community-topbar .tabrail-label { font-size: 16px; font-weight: 500; letter-spacing: -0.3px; color: var(--c-text-4c, #8b95a1); }
      .community-topbar .tabrail-item.is-on .tabrail-label { color: var(--c-text); }
      /* ── 검색창 펼침: clip-path 로 오른쪽 버튼 크기(48px)에서 전체 폭까지 자라게 한다.
         폭을 직접 애니메이션하면 레이아웃이 매 프레임 바뀌어 끊기고, clip-path 는 합성만 해서 부드럽다. ── */
      .community-topbar-inner { position: relative; }
      .csb { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 3; display: flex; align-items: center; pointer-events: none; }
      .csb.is-open { pointer-events: auto; }
      .csb-pill {
        position: relative; flex: 1; min-width: 0; height: 36px; box-sizing: border-box;
        display: flex; align-items: center; gap: 8px; padding: 0 6px 0 14px;
        border-radius: 18px; background: var(--c-bg-muted-2, #f2f4f6);
        clip-path: inset(0 0 0 calc(100% - 48px) round 18px);
        transition: clip-path 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        will-change: clip-path;
      }
      .csb.is-open .csb-pill { clip-path: inset(0 0 0 0 round 18px); }
      .csb-ico, .csb-input, .csb-clear, .csb-cancel { opacity: 0; transition: opacity 0.18s ease; }
      .csb.is-open .csb-ico, .csb.is-open .csb-input, .csb.is-open .csb-clear, .csb.is-open .csb-cancel { opacity: 1; transition: opacity 0.3s ease 0.14s; }
      .csb-ico { flex: none; color: var(--c-text-4c, #8b95a1); }
      .csb-input { flex: 1; min-width: 0; height: 36px; border: none; outline: none; background: transparent; color: var(--c-text); font-size: 16px; font-family: inherit; caret-color: #3182f6; padding: 0; }
      .csb-input::placeholder { color: var(--c-text-5, #b0b8c1); }
      .csb-clear { flex: none; width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: var(--c-text-5, #b0b8c1); color: var(--c-bg, #fff); cursor: pointer; }
      .csb-cancel { flex: none; height: 28px; padding: 0 10px; border: none; background: none; color: var(--c-text-3, #6b7684); font-size: 15px; font-weight: 600; letter-spacing: -0.3px; font-family: inherit; cursor: pointer; white-space: nowrap; }
      /* 펼치면 탭은 옆으로 비켜 사라지고, 원래 검색 버튼은 입력창 속으로 녹아든다. */
      .community-mobile-filters { transition: opacity 0.28s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
      .community-topbar.is-searching .community-mobile-filters { opacity: 0; transform: translateX(-18px); pointer-events: none; }
      .community-topbar .community-icon-button { transition: opacity 0.2s ease, background 0.16s ease; }
      .community-topbar.is-searching .community-icon-button { opacity: 0; pointer-events: none; }
      @media (min-width: 720px) { .csb { display: none; } }
      @media (prefers-reduced-motion: reduce) { .csb-pill, .community-mobile-filters { transition: none; } }
      .community-topbar-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        /* grid 자식이라 min-width:auto 면 내용(탭 레일) 때문에 헤더가 화면 밖으로 넘친다. */
        min-width: 0;
        max-width: 1120px;
        width: 100%;
        margin: 0 auto;
      }
      /* 폰에서는 숨기고 아이콘 버튼을 쓴다(아래 미디어쿼리에서 뒤바뀜). */
      .community-search-inline {
        display: none;
        align-items: center;
        gap: 8px;
        flex: 1 1 auto;
        max-width: 420px;
        margin-left: auto;
        height: 44px;
        padding: 0 14px;
        border-radius: 14px;
        background: var(--c-bg-muted-2);
        border: 1px solid transparent;
        color: var(--c-text-4b);
        box-sizing: border-box;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
      }
      .community-search-inline:focus-within {
        background: var(--c-bg);
        border-color: var(--c-brand);
        box-shadow: 0 0 0 3px rgba(55, 135, 255, 0.12);
      }
      .community-search-inline input {
        flex: 1;
        min-width: 0;
        border: none;
        background: none;
        outline: none;
        font-size: 15px;
        font-family: inherit;
        color: var(--c-text-b);
        letter-spacing: -0.2px;
      }
      .community-search-inline input::placeholder {
        color: var(--c-text-4b);
      }
      .community-search-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 999px;
        background: var(--c-bg-muted-21);
        color: #fff;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
      }
      .community-eyebrow {
        margin: 0 0 2px;
        color: var(--c-text-4c);
        font-size: 11px;
        font-weight: 700;
      }
      .community-title {
        margin: 0;
        color: var(--c-text);
        font-size: 24px;
        font-weight: 700;
      }
      .community-mobile-filters {
        flex: 1;
        min-width: 0;
      }
      /* 헤더 탭이 더 남아 있으면 우측을 그라데이션으로 흐려 '더 있음'을 보여준다.
         끝까지 스크롤하면(is-end) 마스크를 걷어 마지막 탭이 또렷하게 보이게 한다. */
      .community-topbar .tabrail:not(.is-end) {
        -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 34px), transparent 100%);
        mask-image: linear-gradient(to right, #000 calc(100% - 34px), transparent 100%);
      }
      /* 모바일에선 헤더 한 줄이 곧 탭 줄이다 — 제목은 숨기고 탭 + 검색 아이콘만 남긴다. */
      .community-title-wrap { display: none; }
      .community-layout {
        display: grid;
        gap: 14px;
        max-width: 1120px;
        margin: 0 auto;
        padding: 14px 16px 16px;
      }
      .community-filter-panel {
        display: none;
      }
      .community-feed {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 4px;
        min-width: 0;
      }
      .community-feed-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--c-bg-muted-6);
        padding: 6px 2px 14px;
      }
      .community-summary-label {
        margin: 0 0 3px;
        color: var(--c-text-3);
        font-size: 13px;
        font-weight: 600;
      }
      .community-summary-title {
        color: var(--c-text);
        font-size: 20px;
        font-weight: 700;
      }
      .community-summary-stats {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .community-stat-pill {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        border: 1px solid var(--c-bg-muted-8);
        border-radius: 999px;
        background: transparent;
        color: var(--c-text-3);
        padding: 7px 9px;
        font-size: 12px;
        font-weight: 600;
      }
      .community-stat-pill strong {
        color: var(--c-text);
      }
      .weekly-popular {
        margin: 2px 0 16px;
      }
      .weekly-popular-title {
        margin: 0 0 10px;
        font-size: 15px;
        font-weight: 700;
        color: var(--c-text);
        display: flex;
        align-items: baseline;
        gap: 14px;
        flex-wrap: wrap;
      }
      .wp-tab {
        border: none;
        background: none;
        padding: 0;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.3px;
        color: var(--c-text-5);
        cursor: pointer;
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
        transition: color 0.15s ease;
      }
      .wp-tab.is-on { color: var(--c-text); }

      /* 가로 카드 줄: 칼로 자른 듯 끊기지 않게 양끝이 스르륵 사라진다.
         트랙을 화면 가장자리까지 내밀고(--wp-b, 페이지 좌우 여백만큼) 그 여백 구간에만 배경색 그라데이션을 얹는다.
         멈춰 있을 땐 첫 카드가 그대로 보이고, 스크롤하면 카드가 가장자리에서 녹는다.
         (스크롤 영역에 mask 를 씌우면 매 프레임 전체를 다시 칠해 끊겨서, 위에 얹는 오버레이로 바꿨다) */
      .weekly-popular-viewport {
        --wp-b: 16px;
        position: relative;
        margin-left: calc(var(--wp-b) * -1);
        margin-right: calc(var(--wp-b) * -1);
      }
      .weekly-fade {
        position: absolute;
        top: 0;
        bottom: 0;
        width: var(--wp-b);
        pointer-events: none;
        z-index: 2;
      }
      .weekly-fade-l { left: 0; background: linear-gradient(to right, var(--c-bg), transparent); }
      .weekly-fade-r { right: 0; background: linear-gradient(to left, var(--c-bg), transparent); }
      @supports (background: color-mix(in srgb, red 50%, transparent)) {
        .weekly-fade-l { background: linear-gradient(to right, var(--c-bg) 0%, color-mix(in srgb, var(--c-bg) 80%, transparent) 30%, color-mix(in srgb, var(--c-bg) 40%, transparent) 62%, transparent 100%); }
        .weekly-fade-r { background: linear-gradient(to left, var(--c-bg) 0%, color-mix(in srgb, var(--c-bg) 80%, transparent) 30%, color-mix(in srgb, var(--c-bg) 40%, transparent) 62%, transparent 100%); }
      }
      .weekly-popular-track {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        /* 내민 여백만큼 안쪽 여백을 줘서 시작·끝 카드가 원래 줄에 맞게 선다 */
        padding: 20px var(--wp-b) 10px;
        scroll-padding-left: var(--wp-b);
        scroll-padding-right: var(--wp-b);
        scrollbar-width: none;
      }
      .weekly-popular-track::-webkit-scrollbar { display: none; }
      .weekly-popular-card {
        position: relative;
        scroll-snap-align: start;
        flex: 0 0 82%;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-align: left;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid var(--c-bg-muted-6);
        background: var(--c-bg);
        cursor: pointer;
        transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: opacity;
      }
      /* 마지막 카드는 왼쪽 끝에 못 붙으므로(뒤 콘텐츠 없음) 오른쪽 끝 정렬로 스냅 →
         스크롤 최대치가 유효한 스냅 지점이 돼 끝에서 되당겨지는 '뚜둑'이 사라진다. */
      .weekly-popular-card:last-child {
        scroll-snap-align: end;
      }
      /* 순위 메달 — 카드 좌상단 모서리에 살짝 걸쳐진(위로 삐져나온) 느낌 */
      .weekly-popular-medal {
        position: absolute;
        top: -16px;
        left: 6px;
        width: 40px;
        height: 40px;
        z-index: 2;
        pointer-events: none;
      }
      .weekly-popular-top {
        display: flex;
        align-items: center;
        gap: 8px;
        /* 좌상단 메달을 피해 그룹명을 오른쪽으로 */
        padding-left: 38px;
        min-height: 22px;
      }
      .weekly-popular-group {
        font-size: 12px;
        font-weight: 600;
        color: var(--c-text-4);
      }
      .weekly-popular-card-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--c-text);
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .weekly-popular-card-content {
        font-size: 13px;
        color: var(--c-text-3);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .weekly-popular-card-metrics {
        display: flex;
        gap: 14px;
        margin-top: 2px;
        font-size: 12px;
        font-weight: 600;
        color: var(--c-text-4);
      }
      .weekly-popular-card-metrics span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .weekly-popular-dots {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .weekly-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--c-bg-muted-22);
        transition: width 0.2s ease, background 0.2s ease;
      }
      .weekly-dot.active {
        width: 18px;
        background: var(--c-brand);
      }
      .community-message {
        border: 1px solid var(--c-brand-line-9);
        background: var(--c-brand-soft-4);
        color: var(--c-brand-deep-2);
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 500;
      }
      .community-post-list {
        display: grid;
        gap: 0;
      }
      /* 토스 커뮤니티식 카드(프리티풀 .tcard 와 같은 문법). 눌러도 어두워지거나 줄어들지 않는다(딤·스케일 없음). */
      .community-post-card {
        display: grid;
        gap: 12px;
        border-bottom: 1px solid var(--c-bg-muted-6);
        background: transparent;
        padding: 20px 2px 14px;
        cursor: pointer;
        animation: communityCardIn 0.22s ease;
        -webkit-tap-highlight-color: transparent;
        transform: none;
      }
      .community-post-card:hover,
      .community-post-card:active {
        transform: none;
        background: transparent;
        opacity: 1;
      }
      .community-post-card:focus-visible,
      .community-icon-button:focus-visible,
      .tabrail-item:focus-visible,
      .community-floating-write:focus-visible {
        outline: 2px solid var(--c-inverse);
        outline-offset: 3px;
      }
      .community-post-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tc-ava-wrap {
        position: relative;
        flex: none;
        width: 52px;
        height: 52px;
      }
      .tc-who {
        min-width: 0;
        flex: 1;
      }
      .tc-ava-wrap.is-link, .tc-who.is-link { cursor: pointer; }
      /* 아바타 오른쪽 아래에 겹치는 파란 알약(토스 '주주' 자리 = 게시판 이름) */
      /* 닉네임 글자에 게시판 색 그라데이션(글자 모양으로만 칠한다) */
      .tc-name {
        min-width: 0;
        overflow-wrap: anywhere;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
      }
      .tc-role {
        position: absolute;
        right: -8px;
        bottom: -3px;
        max-width: 64px;
        height: 20px;
        padding: 0 7px;
        border-radius: 999px;
        background: #3182f6;
        color: #fff;
        font-size: 11.5px;
        font-weight: 700;
        line-height: 20px;
        letter-spacing: -0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 0 0 2px var(--c-bg, #fff);
      }
      .community-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 999px;
        background: var(--c-bg-muted);
        color: #a3acb8; /* 사진이 없을 때 첫 글자: 연한 쿨그레이 */
        font-size: 19px;
        font-weight: 700;
        overflow: hidden;
      }
      .community-avatar-img {
        width: 74%;
        height: 74%;
        object-fit: contain;
        display: block;
      }
      /* 프로필 사진(카톡)은 원을 꽉 채운다. */
      .community-avatar-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      /* 좋아요 누른 사람 겹친 프로필 */
      .liker-stack {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .liker-avatars {
        display: inline-flex;
        align-items: center;
      }
      .liker-av {
        position: relative;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--c-bg-muted);
        border: 1.5px solid var(--c-bg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .liker-av img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .liker-letter {
        font-size: 11px;
        font-weight: 700;
        color: var(--c-text-3);
      }
      .liker-count {
        font-size: 12px;
        font-weight: 600;
        color: var(--c-text-4);
      }
      .community-post-author {
        margin: 0;
        color: var(--c-text);
        font-size: 17px;
        font-weight: 700;
        letter-spacing: -0.3px;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
      }
      .community-post-date {
        margin: 3px 0 0;
        color: var(--c-text-4c);
        font-size: 14.5px;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      .community-group-badge {
        border-radius: 999px;
        background: var(--c-bg-muted);
        color: var(--c-text-2c);
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
      }
      .community-post-title {
        margin: 0;
        color: var(--c-text);
        font-size: 17.5px;
        line-height: 1.55;
        font-weight: 700;
        letter-spacing: -0.3px;
      }
      .community-post-content {
        margin: 0;
        color: var(--c-text);
        font-size: 17.5px;
        letter-spacing: -0.3px;
        line-height: 1.65;
        white-space: pre-wrap;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .community-post-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .community-post-image-single,
      .community-post-image-grid {
        display: grid;
        gap: 6px;
        max-width: 680px;
      }
      .community-post-image-single {
        grid-template-columns: minmax(0, 1fr);
      }
      .community-post-image-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .community-post-image-thumb {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid var(--c-bg-muted-6);
        background: var(--c-bg-soft);
        aspect-ratio: 4 / 3;
      }
      .community-post-image-single .community-post-image-thumb {
        aspect-ratio: 16 / 10;
      }
      .community-post-image-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .community-post-image-thumb span {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 24, 39, 0.54);
        color: #fff;
        font-size: 20px;
        font-weight: 700;
      }
      .community-tag-badge {
        border-radius: 999px;
        background: transparent;
        border: 1px solid var(--c-bg-muted-6);
        color: var(--c-text-3);
        padding: 6px 9px;
        font-size: 12px;
        font-weight: 600;
      }
      /* 목록에서 미리 보는 '제일 상단 댓글' 1개 */
      .community-top-comment {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 9px 12px;
        border-radius: 12px;
        background: var(--c-bg-soft-3);
        color: var(--c-text-3);
        font-size: 13px;
        line-height: 1.4;
      }
      .community-top-comment > svg {
        flex-shrink: 0;
        color: var(--c-text-4);
      }
      .community-top-comment .ctc-pin {
        color: var(--c-brand);
      }
      .community-top-comment .ctc-body {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .community-top-comment .ctc-body b {
        color: var(--c-text-2c);
        font-weight: 700;
        margin-right: 4px;
      }
      .community-top-comment .ctc-more {
        flex-shrink: 0;
        color: var(--c-text-4);
        font-size: 12px;
        font-weight: 600;
      }
      .community-post-metrics {
        display: flex;
        align-items: center;
        gap: 22px;
        margin-top: 2px;
        color: var(--c-text-3);
        font-size: 17px;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      .community-post-metrics span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .community-post-metrics .tc-more {
        margin-left: auto;
      }
      .community-link-toast {
        position: fixed;
        left: 50%;
        bottom: calc(110px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        z-index: 300;
        padding: 12px 18px;
        border-radius: 12px;
        background: rgba(25, 31, 40, 0.92);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
      }
      /* 목록에서 바로 누르는 좋아요/댓글 버튼 — 텍스트처럼 보이되 눌리는 티(축소/음영)는 없앤다. */
      .community-metric-btn {
        appearance: none;
        border: none;
        background: none;
        padding: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: color 0.15s ease;
      }
      .community-metric-btn:active { transform: none; opacity: 1; }
      .community-metric-btn:disabled {
        cursor: default;
      }
      .community-metric-btn.is-reposted { color: #03a94d; }
      .community-metric-btn.is-reposted svg { animation: repostSpin 0.55s cubic-bezier(0.34, 1.56, 0.64, 1); }
      @keyframes repostSpin { from { transform: rotate(-180deg) scale(0.7); } to { transform: none; } }
      .community-metric-btn.is-liked {
        color: var(--c-danger-b, #e8544e);
      }
      @media (hover: hover) {
        .community-metric-btn:not(.is-liked):hover {
          color: var(--c-text);
        }
      }
      /* ── 목록 댓글 모달(바텀시트) — 글 상세와 같은 토스 톤 ──
         열릴 때: 딤 페이드 + 시트가 스프링으로 올라오고 목록이 차례로 떠오른다. 닫을 때(.is-leaving): 내려가며 사라진다. */
      .community-comment-modal {
        position: fixed;
        top: 0; right: 0; bottom: 0; left: 0; /* inset 단축은 구형 안드로이드 WebView 가 모른다 */
        box-sizing: border-box; /* 키보드 높이를 padding-bottom 으로 받으므로 필요 */
        z-index: 95;
        background: rgba(15, 23, 42, 0.42);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: mdlFade 0.24s ease-out backwards;
      }
      .community-comment-sheet {
        width: 100%;
        max-width: 620px;
        /* 기본 높이는 화면의 70% — 절반이면 댓글이 서너 개만 보여 너무 좁았다.
           vh 대신 오버레이(top/bottom:0) 기준 % — 안드로이드 WebView vh 오계산 회피 */
        height: 70%;
        max-height: 88%;
        display: flex;
        flex-direction: column;
        background: var(--c-bg);
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        box-shadow: 0 -14px 40px rgba(15, 23, 42, 0.18);
        animation: mdlSheet 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        /* WebView 에서 border-radius + overflow:hidden 이 자식 레이어를 깨는 일이 있어 자식에 라운드를 직접 준다 */
      }
      .community-comment-modal.is-leaving { pointer-events: none; animation: mdlFadeOut 0.24s ease-in forwards; }
      .community-comment-modal.is-leaving .community-comment-sheet { animation: mdlSheetOut 0.26s cubic-bezier(0.4, 0, 1, 1) forwards; }
      /* 끌어서 닫을 땐 손가락이 놓은 자리에서 이어 내려가야 하므로 키프레임 대신 인라인 transition 을 쓴다. */
      .community-comment-modal.is-leaving.is-dragged .community-comment-sheet { animation: none; }
      @media (min-width: 720px) {
        .community-comment-modal { align-items: center; }
        .community-comment-sheet { border-radius: 24px; height: auto; min-height: 50%; max-height: 74%; animation-name: mdlPop; animation-duration: 0.42s; }
        .community-comment-modal.is-leaving .community-comment-sheet { animation-name: mdlPopOut; animation-duration: 0.22s; }
        .ccs-handle { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .community-comment-modal, .community-comment-sheet, .ccs-c { animation: none !important; }
      }
      /* 위쪽 손잡이+제목 줄 — 여기를 아래로 끌면 닫힌다 */
      .ccs-grab { flex-shrink: 0; touch-action: none; cursor: grab; }
      .ccs-handle { display: block; width: 36px; height: 4px; border-radius: 2px; background: var(--c-bg-muted-8, #d1d6db); margin: 10px auto 0; }
      .ccs-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px 4px 20px;
      }
      .ccs-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; color: var(--c-text); }
      .ccs-close {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 12px;
        border: none;
        background: transparent;
        color: var(--c-text-3);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      /* 정렬 드롭다운 '인기순 ⇅' */
      .ccs-sortwrap { position: relative; flex-shrink: 0; padding: 0 20px; }
      .ccs-sortbtn { display: inline-flex; align-items: center; gap: 4px; padding: 8px 0; border: none; background: none; color: var(--c-text-3, #6b7684); font-size: 16px; font-weight: 500; letter-spacing: -0.3px; cursor: pointer; font-family: inherit; }
      .ccs-sort-backdrop { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1; }
      .ccs-sort-menu { position: absolute; top: calc(100% - 2px); left: 14px; z-index: 2; min-width: 150px; display: grid; padding: 8px; background: var(--c-bg, #fff); border-radius: 18px; box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16), 0 2px 10px rgba(15, 23, 42, 0.06); animation: ccsMenuIn 0.28s cubic-bezier(0.33, 1, 0.68, 1) backwards; transform-origin: top left; }
      .ccs-sort-item { display: flex; align-items: center; padding: 11px 12px; border: none; background: none; border-radius: 12px; color: var(--c-text-2c, #333d4b); font-size: 16px; font-weight: 500; text-align: left; cursor: pointer; font-family: inherit; }
      .ccs-sort-item.on { color: #3182f6; font-weight: 700; }
      @keyframes ccsMenuIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
      .ccs-list {
        flex: 1 1 auto;
        /* 0 까지 줄어들 수 있어야 좁은 화면에서 입력창이 밀려나지 않는다. */
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 4px 20px 12px;
        display: flex;
        flex-direction: column;
      }
      .ccs-empty-sleep { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .ccs-empty-sleep img { display: block; }
      .ccs-empty-sleep p { margin: 0; font-size: 14px; font-weight: 600; color: var(--c-text-4); line-height: 1.5; text-align: center; }
      .ccs-empty {
        margin: 0;
        padding: 28px 0;
        text-align: center;
        color: var(--c-text-4);
        font-size: 14px;
        font-weight: 500;
      }
      /* 댓글 한 줄: 아바타 · 이름·시간 / 본문 / 하트·답글 달기·⋯ (답글은 본문 칸 안에 들여써서 이어진다) */
      .ccs-c { display: flex; gap: 12px; padding: 14px 0 10px; animation: mdlRise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
      .ccs-c:nth-child(1) { animation-delay: 0.16s; }
      .ccs-c:nth-child(2) { animation-delay: 0.21s; }
      .ccs-c:nth-child(3) { animation-delay: 0.26s; }
      .ccs-c:nth-child(4) { animation-delay: 0.31s; }
      .ccs-c:nth-child(n+5) { animation-delay: 0.36s; }
      .ccs-c.is-reply { padding: 10px 0 4px; animation: none; }
      .ccs-c-main { min-width: 0; flex: 1; }
      .ccs-item { display: flex; align-items: center; flex-wrap: wrap; gap: 0; }
      .ccs-name { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; color: var(--c-text-3, #6b7684); }
      .ccs-time { margin-left: 5px; font-size: 15px; font-weight: 500; color: var(--c-text-4c, #8b95a1); }
      /* 댓글 아바타(사진 or 첫 글자 — 사진이 없을 땐 연한 쿨그레이) */
      .ccs-av {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--c-bg-muted);
        color: #a3acb8;
        font-size: 19px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .ccs-av.is-sm { width: 34px; height: 34px; font-size: 15px; }
      .ccs-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .ccs-content {
        margin: 4px 0 0;
        font-size: 17px;
        line-height: 1.6;
        letter-spacing: -0.3px;
        color: var(--c-text);
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .ccs-c.is-active > .ccs-c-main > .ccs-content { background: rgba(49, 130, 246, 0.07); border-radius: 8px; }
      .ccs-c-acts { display: flex; align-items: center; gap: 16px; margin-top: 6px; color: #6b7684; }
      .ccs-like, .ccs-reply { display: inline-flex; align-items: center; gap: 5px; padding: 4px 2px; border: none; background: none; color: inherit; font-size: 15px; font-weight: 500; letter-spacing: -0.2px; font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .ccs-like.is-liked { color: #f04452; }
      .ccs-more { margin-left: auto; display: inline-flex; }
      .ccs-replies { margin-top: 2px; }
      .ccs-msg {
        margin: 0;
        padding: 6px 20px;
        color: var(--c-brand-deep-2);
        font-size: 13px;
        font-weight: 600;
      }
      .ccs-action {
        border: none; background: none; padding: 4px 2px; font-size: 14px; font-weight: 600;
        color: #6b7684; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent;
      }
      .ccs-action:disabled { opacity: 0.5; cursor: default; }
      .ccs-action.is-primary { color: var(--c-brand); font-weight: 700; }
      .ccs-action.is-danger { color: #D63A3A; font-weight: 700; }
      .ccs-action.is-danger-soft { color: var(--c-danger-b, #e8544e); }
      .ccs-editbox { margin-top: 6px; }
      .ccs-edit {
        width: 100%; box-sizing: border-box; min-height: 60px; max-height: 160px; resize: none;
        border: 1px solid var(--c-brand); border-radius: 12px; padding: 10px 12px;
        font-size: 16px; line-height: 1.45; color: var(--c-text); background: var(--c-bg); outline: none; font-family: inherit;
      }
      .ccs-editbtns { display: flex; justify-content: flex-end; gap: 14px; margin-top: 6px; }
      .ccs-confirm {
        margin-top: 8px; display: flex; align-items: center; gap: 12px;
        padding: 8px 12px; border-radius: 12px; background: var(--c-bg-muted); font-size: 13.5px; color: var(--c-text-3);
      }
      .ccs-confirm span { flex: 1; }
      /* 아래 고정 입력 영역: 이모지 줄 + 내 아바타 + 회색 입력창(답글이면 파란 @닉네임) */
      .ccs-dock { flex-shrink: 0; background: var(--c-bg); padding: 6px 16px calc(12px + env(safe-area-inset-bottom, 0px)); }
      .ccs-react-bar { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 8px; }
      .emoji-bar-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: none; border-radius: 14px; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .emoji-bar-btn:active { transform: scale(0.86); }
      .ccs-compose { display: flex; align-items: center; gap: 10px; }
      .ccs-bar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; box-sizing: border-box; height: 52px; padding: 8px 8px 8px 18px; border-radius: 26px; background: var(--c-bg-muted-2, #f2f4f6); }
      .ccs-mention { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0; border: none; background: none; color: #3182f6; font-size: 16px; font-weight: 500; letter-spacing: -0.2px; font-family: inherit; cursor: pointer; }
      .ccs-input { flex: 1; min-width: 0; height: 36px; border: none; outline: none; background: transparent; color: var(--c-text); font-size: 16px; font-family: inherit; caret-color: #3182f6; padding: 0; }
      .ccs-input::placeholder { color: var(--c-text-5, #b0b8c1); }
      .ccs-send { flex: none; width: 48px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 18px; background: #3182f6; cursor: pointer; transition: background 0.15s ease, transform 0.12s ease; }
      .ccs-send:active:not(:disabled) { transform: scale(0.94); }
      .ccs-send:disabled { background: #d1d6db; cursor: default; }
      @keyframes communitySheetUp {
        from { transform: translateY(28px); opacity: 0.6; }
        to { transform: translateY(0); opacity: 1; }
      }
      .community-icon-button:active,
      .community-floating-write:active {
        transform: scale(0.97);
      }
      .community-search-input {
        animation: communitySearchIn 0.18s ease;
      }
      .community-icon-button:hover {
        background: var(--c-bg-muted-3, #e8ebed) !important;
      }
      .community-floating-write {
        transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease, background 0.18s ease;
      }
      .community-floating-write:hover {
        box-shadow: 0 18px 34px rgba(17, 24, 39, 0.28) !important;
        transform: translateY(-1px);
      }
      .community-skeleton-card {
        cursor: default;
        background: transparent;
      }
      .community-skeleton-line {
        height: 13px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--c-bg-muted), var(--c-bg-muted-20), var(--c-bg-muted));
        background-size: 200% 100%;
        animation: communitySkeleton 1.15s ease-in-out infinite;
      }
      @media (min-width: 720px) {
        .community-topbar {
          padding-left: 24px;
          padding-right: 24px;
        }
        .community-mobile-filters {
          display: none;
        }
        .community-title-wrap { display: block; }
        /* 넓은 화면에선 검색 아이콘 버튼 대신 펼쳐진 검색창을 쓴다. */
        .community-search-inline {
          display: flex;
        }
        /* 아이콘 버튼은 인라인 style에 display:flex가 있어 !important가 필요하다. */
        .community-topbar .community-icon-button,
        .community-topbar .community-search-input {
          display: none !important;
        }
        .community-layout {
          grid-template-columns: 104px minmax(0, 1fr);
          align-items: start;
          gap: 28px;
          padding: 22px 24px;
        }
        .community-filter-panel {
          position: sticky;
          top: calc(92px + env(safe-area-inset-top, 0px));
          display: grid;
          gap: 14px;
          background: transparent;
          padding: 4px 0;
        }
        .community-filter-block {
          display: grid;
          gap: 10px;
        }
        .community-filter-title {
          margin: 0;
          color: var(--c-text-4c);
          font-size: 12px;
          font-weight: 700;
        }
        .community-post-card {
          padding: 20px 4px 21px;
        }
        .community-post-title {
          font-size: 18.5px;
        }
      }
      /* 태블릿(>=744px): 좌측 세로 네비 알약(84px offset) + app-body 중앙 정렬 +
         app-shell 좌우 패딩(20px)을 반영해, 뷰포트 중앙 720px 고정이던 헤더를
         아래 피드 콘텐츠 박스와 정확히 좌우 정렬한다. (104 = 84+20, 124 = 84+20+20) */
      @media (min-width: 744px) {
        .community-topbar {
          left: calc(max(0px, (100vw - 1024px) / 2) + 104px + env(safe-area-inset-left, 0px));
          width: calc(min(100vw, 1024px) - 124px - env(safe-area-inset-left, 0px));
          max-width: none;
          right: auto;
          transform: none;
        }
      }
      @media (min-width: 1180px) {
        .community-topbar {
          left: calc(max(0px, (100vw - 1280px) / 2) + 104px + env(safe-area-inset-left, 0px));
          width: calc(min(100vw, 1280px) - 124px - env(safe-area-inset-left, 0px));
        }
      }
      @keyframes communitySearchIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes communityCardIn {
        from { opacity: 0; transform: translateY(7px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes communitySkeleton {
        from { background-position: 200% 0; }
        to { background-position: -200% 0; }
      }
    `}</style>
  );
}

// 카테고리 알약 칩: 선택은 짙은 차콜, 나머지는 연회색(보더 없이 면으로만 구분).
// 검색 버튼 — 댓글 입력창과 같은 연한 회색 알약(48×36, 반경 18).
const iconButtonStyle = {
  width: 48,
  height: 36,
  border: "none",
  borderRadius: 18,
  background: "var(--c-bg-muted-2, #f2f4f6)",
  color: "var(--c-text-2, #333d4b)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid var(--c-border-strong)",
  borderRadius: 8,
  padding: "12px 13px",
  color: "var(--c-text)",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

const emptyPanelStyle = {
  display: "grid",
  gap: 12,
  borderTop: "1px solid var(--c-bg-muted-6)",
  borderBottom: "1px solid var(--c-bg-muted-6)",
  background: "transparent",
  padding: "22px 2px",
} as const;

// 말풍선 넛지 + 글쓰기 버튼을 함께 띄우는 도크(둘을 세로로 쌓아 우하단 고정).
const floatingWriteDockStyle = {
  position: "fixed",
  right: "max(18px, calc((100vw - 720px) / 2 + 18px))",
  bottom: "calc(98px + env(safe-area-inset-bottom, 0px))",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  zIndex: 55,
  // 도크의 빈 영역(말풍선 옆/아래)이 목록 터치를 먹지 않도록 버튼에서만 입력을 받는다.
  pointerEvents: "none",
} as const;

const floatingWriteButtonStyle = {
  pointerEvents: "auto",
  border: "none",
  borderRadius: 999,
  background: "var(--c-inverse)",
  color: "#fff",
  padding: "13px 18px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(17,24,39,0.24)",
  zIndex: 55,
} as const;
