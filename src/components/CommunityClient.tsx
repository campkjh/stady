"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clientCache } from "@/lib/clientCache";
import AnswerKingBadge from "@/components/AnswerKingBadge";
import NudgeBubble from "@/components/NudgeBubble";
import { WRITE_NUDGE_KEY, todayKey } from "@/lib/writeNudge";
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

interface CommunityPost {
  id: string;
  nickname: string;
  authorTier?: string;
  authorIsAdmin?: boolean;
  authorIsAnswerKing?: boolean;
  groupName: string;
  groupSlug?: string;
  title: string;
  content: string;
  type?: string;
  isBlinded?: boolean;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  imageUrls: string[];
  tags: CommunityTag[];
}

const TIERS = ["iron", "silver", "gold", "emerald", "diamond", "master"];
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
  const topbarRef = useRef<HTMLElement | null>(null);
  // 캐시된 값으로 초기화 → 탭 재진입 시 즉시 표시(로딩/깜빡임 없음).
  const [groups, setGroups] = useState<CategoryGroup[]>(() => clientCache.get<CategoryGroup[]>("community-groups") ?? []);
  const [posts, setPosts] = useState<CommunityPost[]>(() => clientCache.get<CommunityPost[]>(postsKey("", "")) ?? []);
  const [weeklyPosts, setWeeklyPosts] = useState<CommunityPost[]>(() => clientCache.get<CommunityPost[]>("community-weekly") ?? []);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [message, setMessage] = useState("");
  // 캐시가 있으면 로딩 표시 안 함(데이터 변동 시에만 갱신).
  const [loading, setLoading] = useState(() => !clientCache.has(postsKey("", "")));
  const [topbarHeight, setTopbarHeight] = useState(0);
  const weeklyTrackRef = useRef<HTMLDivElement | null>(null);
  const [weeklyActiveIndex, setWeeklyActiveIndex] = useState(0);
  const [weeklyAtEnd, setWeeklyAtEnd] = useState(false);
  const scrollRestoredRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);
  // 오늘 아직 글을 안 썼을 때만 글쓰기 말풍선을 띄운다(서버 렌더 깜빡임 방지로 기본 false).
  const [showWriteNudge, setShowWriteNudge] = useState(false);
  // 아래로 스크롤하면 카테고리 탭을 한 줄(아이콘+라벨)로 접어 헤더를 낮춘다.
  const [compactHeader, setCompactHeader] = useState(false);

  useEffect(() => {
    loadGroups();
    loadWeeklyPopular();
  }, []);

  useEffect(() => {
    try {
      setShowWriteNudge(localStorage.getItem(WRITE_NUDGE_KEY) !== todayKey());
    } catch {
      setShowWriteNudge(true);
    }
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

  // 접혔을 때 항목 너비(아이콘 30 + 여백 + 라벨). 라벨 길이가 제각각이라 실제로 재서 넣는다.
  useEffect(() => {
    const bar = topbarRef.current;
    if (!bar) return;
    bar.querySelectorAll<HTMLElement>(".tabrail-item").forEach((item) => {
      const label = item.querySelector<HTMLElement>(".tabrail-label");
      if (!label) return;
      // 라벨은 접히면 11px → 12.5px 로 커지므로 그 비율만큼 넉넉히 잡는다.
      const w = Math.ceil(label.scrollWidth * (12.5 / 11));
      item.style.setProperty("--cw", `${38 + w + 10}px`);
    });
  }, [groups]);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      // 손떨림 정도(6px 미만)는 방향으로 치지 않는다.
      if (Math.abs(dy) < 6) return;
      lastY = y;
      // 최상단 근처에서는 항상 펼쳐둔다.
      setCompactHeader(y > 60 && dy > 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      if (clientCache.set("community-groups", ordered)) setGroups(ordered);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.");
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
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
      const fresh = data.posts || [];
      // 달라졌을 때만 갱신(데이터 변동 시에만 리렌더).
      if (clientCache.set(key, fresh)) setPosts(fresh);
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

  function openPost(postId: string) {
    // 상세로 가기 전 현재 스크롤 위치를 저장해 두고, 돌아오면 그 자리로 복원한다.
    try { sessionStorage.setItem("community-scroll", String(window.scrollY)); } catch {}
    router.push(`/community/${postId}`);
  }

  // 주간 인기글 슬라이드에서 현재 보이는(가장 왼쪽에 스냅된) 카드 인덱스를 추적해
  // 하단 인디케이터에 반영한다.
  function handleWeeklyScroll() {
    const track = weeklyTrackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    if (cards.length === 0) return;
    const trackLeft = track.getBoundingClientRect().left;
    let nearest = 0;
    let min = Infinity;
    cards.forEach((card, i) => {
      const d = Math.abs(card.getBoundingClientRect().left - trackLeft);
      if (d < min) { min = d; nearest = i; }
    });
    setWeeklyActiveIndex(nearest);
    setWeeklyAtEnd(track.scrollLeft >= track.scrollWidth - track.clientWidth - 4);
  }

  // 주간 인기글 2.4초마다 자동 전환(자동 스와이프). 끝에 닿으면 처음으로 순환.
  useEffect(() => {
    if (weeklyPosts.length <= 1) return;
    const id = window.setInterval(() => {
      const track = weeklyTrackRef.current;
      if (!track) return;
      const cards = Array.from(track.children) as HTMLElement[];
      if (cards.length === 0) return;
      const trackLeft = track.getBoundingClientRect().left;
      let cur = 0;
      let min = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.getBoundingClientRect().left - trackLeft);
        if (d < min) { min = d; cur = i; }
      });
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      const next = atEnd ? 0 : (cur + 1) % cards.length;
      const delta = cards[next].getBoundingClientRect().left - trackLeft;
      track.scrollBy({ left: delta, behavior: "smooth" });
    }, 2400);
    return () => window.clearInterval(id);
  }, [weeklyPosts.length]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );
  return (
    <main className="community-page" style={{ "--community-header-height": `${topbarHeight}px` } as CSSProperties}>
      <header ref={topbarRef} className={`community-topbar${compactHeader ? " is-compact" : ""}`}>
        <div className="community-topbar-inner">
          <div>
            <h1 className="community-title">커뮤니티</h1>
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
            onClick={() => {
              if (searchOpen) setQuery("");
              setSearchOpen((current) => !current);
            }}
            aria-label="커뮤니티 검색"
            title="검색"
            style={iconButtonStyle}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {searchOpen && (
          <input
            className="community-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={selectedGroup ? `${selectedGroup.name}에서 검색` : "커뮤니티 검색"}
            autoFocus
            style={searchStyle}
          />
        )}
        <div className="community-mobile-filters">
          <CategoryChips
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelect={(id) => setSelectedGroupId(id)}
          />
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
            <section className="weekly-popular" aria-label="주간 인기글">
              <h2 className="weekly-popular-title">
                <img src="/icons/medal.svg" alt="" width={18} height={18} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                주간 인기글
              </h2>
              <div className="weekly-popular-viewport">
                <div className="weekly-popular-track" ref={weeklyTrackRef} onScroll={handleWeeklyScroll}>
                {weeklyPosts.map((post, index) => (
                  <button
                    key={post.id}
                    type="button"
                    className="weekly-popular-card"
                    onClick={() => openPost(post.id)}
                    style={{ transform: index === weeklyActiveIndex ? "scale(1)" : "scale(0.94)" }}
                  >
                    <span className="weekly-popular-top">
                      <span className="weekly-popular-rank">{index + 1}</span>
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
                <div className="weekly-edge weekly-edge-right" aria-hidden="true" style={{ opacity: weeklyAtEnd ? 0 : 1 }} />
              </div>
              {weeklyPosts.length > 1 && (
                <div className="weekly-popular-dots" aria-hidden="true">
                  {weeklyPosts.map((post, index) => (
                    <span key={post.id} className={index === weeklyActiveIndex ? "weekly-dot active" : "weekly-dot"} />
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="community-post-list">
            {loading ? (
              <>
                <SkeletonPost />
                <SkeletonPost />
              </>
            ) : posts.length === 0 ? (
              <div style={emptyPanelStyle}>
                <p style={{ margin: 0, color: "#6B7280", fontSize: 14, fontWeight: 500 }}>아직 게시글이 없습니다.</p>
              </div>
            ) : (
              posts.map((post) => (
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
                  <div className="community-post-head">
                    <div className="community-avatar" aria-hidden="true">
                      {post.authorIsAdmin ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/icons/stady-app-icon.svg" alt="" className="community-avatar-img" />
                      ) : (
                        post.nickname.slice(0, 1)
                      )}
                    </div>
                    <div>
                      <p className="community-post-author">{post.nickname}<TierBadge tier={post.authorTier} /><AnswerKingBadge show={post.authorIsAnswerKing} /></p>
                      <p className="community-post-date" title={formatExactTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</p>
                    </div>
                    <span className="community-group-badge">{post.groupName}</span>
                  </div>
                  <h2 className="community-post-title">
                    {post.type === "poll" && (
                      <span
                        style={{
                          display: "inline-block",
                          marginRight: 6,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "#EFF6FF",
                          color: "#1D4ED8",
                          fontSize: 12,
                          fontWeight: 600,
                          verticalAlign: "middle",
                        }}
                      >
                        📊 투표
                      </span>
                    )}
                    {post.groupSlug === "qna" && <QBadge answered={post.commentCount > 0} />}
                    {post.title}
                  </h2>
                  <p className="community-post-content">{post.content}</p>
                  {post.imageUrls.length > 0 && (
                    <div className={post.imageUrls.length === 1 ? "community-post-image-single" : "community-post-image-grid"}>
                      {post.imageUrls.slice(0, 4).map((imageUrl, index) => (
                        <div key={imageUrl} className="community-post-image-thumb">
                          <img
                            src={imageUrl}
                            alt={post.isBlinded ? "블라인드 이미지" : `${post.title} 이미지 ${index + 1}`}
                            style={post.isBlinded ? { filter: "blur(18px)", transform: "scale(1.05)" } : undefined}
                          />
                          {post.isBlinded && (
                            <span
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: "rgba(17, 24, 39, 0.55)",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              🙈 블라인드
                            </span>
                          )}
                          {index === 3 && post.imageUrls.length > 4 && (
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
                  <div className="community-post-metrics">
                    <span>
                      <HeartIcon /> 좋아요 {post.likeCount || 0}
                    </span>
                    <span>
                      <CommentIcon /> 댓글 {post.commentCount || 0}
                    </span>
                    <span>
                      <EyeIcon /> 조회 {post.viewCount || 0}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div style={floatingWriteDockStyle}>
        {showWriteNudge && (
          <NudgeBubble
            icon="xp-write"
            text="하루에 한번 커뮤니티 글 쓰기"
            xp={10}
            tailAlign="end"
            tailInset={26}
          />
        )}
        <button
          type="button"
          className="community-floating-write"
          onClick={() => router.push("/community/write")}
          style={floatingWriteButtonStyle}
        >
          게시글 +
        </button>
      </div>
      <CommunityStyles />
    </main>
  );
}

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

function CategoryChips({
  groups,
  selectedGroupId,
  onSelect,
  stacked = false,
}: {
  groups: CategoryGroup[];
  selectedGroupId: string;
  onSelect: (id: string) => void;
  stacked?: boolean;
}) {
  const items = [{ id: "", name: "전체", icon: "cg-all" }, ...groups.map((g) => ({ id: g.id, name: g.name, icon: groupIcon(g.name) }))];
  return (
    <nav className={`tabrail${stacked ? " is-stacked" : ""}`} aria-label="커뮤니티 카테고리">
      {items.map((it) => {
        const on = selectedGroupId === it.id;
        return (
          <button
            key={it.id || "all"}
            type="button"
            className={`tabrail-item${on ? " is-on" : ""}`}
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

function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20.5C8.2 17.1 5 14.25 5 10.85C5 8.65 6.7 7 8.8 7C10 7 11.15 7.55 12 8.45C12.85 7.55 14 7 15.2 7C17.3 7 19 8.65 19 10.85C19 14.25 15.8 17.1 12 20.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 17.5H7C4.8 17.5 3 15.7 3 13.5V9C3 6.8 4.8 5 7 5H17C19.2 5 21 6.8 21 9V13.5C21 15.7 19.2 17.5 17 17.5H12.8L8.7 20.2C8.2 20.55 7.5 20.18 7.5 19.57V17.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12C4 8.2 7.7 5.8 12 5.8C16.3 5.8 20 8.2 21.5 12C20 15.8 16.3 18.2 12 18.2C7.7 18.2 4 15.8 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CommunityStyles() {
  return (
    <style>{`
      .community-page {
        min-height: 100vh;
        background: #fff;
        color: #111827;
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
        background: #fff;
        border-bottom: 1px solid #EEF0F3;
        padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
        transition: gap 0.24s cubic-bezier(0.22, 1, 0.36, 1), padding 0.24s cubic-bezier(0.22, 1, 0.36, 1);
      }
      /* 스크롤을 내리면 카테고리 탭이 '아이콘 위·라벨 아래'에서 '아이콘 옆 라벨'로
         접히며 헤더가 그만큼 낮아진다. flex-direction은 애니메이션이 안 되므로
         라벨을 절대배치로 두고 위치·크기만 바꾼다 → 매 프레임 부드럽게 이어진다.
         (--cw = 접혔을 때 항목 너비. 라벨 길이가 달라 마운트 후 JS로 재서 넣는다) */
      .community-topbar .tabrail-item {
        position: relative;
        flex-direction: row;
        justify-content: flex-start;
        width: 64px;
        height: 67px;
        padding: 0;
        transition: width 0.26s cubic-bezier(0.22, 1, 0.36, 1), height 0.26s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .community-topbar .tabrail-ico {
        position: absolute;
        left: 50%;
        top: 4px;
        transform: translateX(-50%);
        transition: left 0.26s cubic-bezier(0.22, 1, 0.36, 1), top 0.26s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
          height 0.26s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.26s ease, background 0.16s ease;
      }
      .community-topbar .tabrail-ico img {
        transition: width 0.26s cubic-bezier(0.22, 1, 0.36, 1), height 0.26s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .community-topbar .tabrail-label {
        position: absolute;
        left: 50%;
        top: 47px;
        transform: translateX(-50%);
        transition: left 0.26s cubic-bezier(0.22, 1, 0.36, 1), top 0.26s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), font-size 0.26s cubic-bezier(0.22, 1, 0.36, 1),
          color 0.16s ease;
      }
      .community-topbar.is-compact .tabrail-item {
        width: var(--cw, 96px);
        height: 36px;
      }
      .community-topbar.is-compact .tabrail-ico {
        left: 3px;
        top: 3px;
        transform: none;
        width: 30px;
        height: 30px;
        border-radius: 10px;
      }
      .community-topbar.is-compact .tabrail-ico img {
        width: 19px;
        height: 19px;
      }
      .community-topbar.is-compact .tabrail-label {
        left: 38px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12.5px;
      }
      @media (prefers-reduced-motion: reduce) {
        .community-topbar {
          transition: none;
        }
      }
      .community-topbar-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
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
        background: #f2f4f6;
        border: 1px solid transparent;
        color: #8b95a1;
        box-sizing: border-box;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
      }
      .community-search-inline:focus-within {
        background: #fff;
        border-color: #3787ff;
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
        color: #191f28;
        letter-spacing: -0.2px;
      }
      .community-search-inline input::placeholder {
        color: #8b95a1;
      }
      .community-search-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 999px;
        background: #dfe3e8;
        color: #fff;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
      }
      .community-eyebrow {
        margin: 0 0 2px;
        color: #9ca3af;
        font-size: 11px;
        font-weight: 700;
      }
      .community-title {
        margin: 0;
        color: #111827;
        font-size: 24px;
        font-weight: 700;
      }
      .community-mobile-filters {
        display: grid;
        gap: 8px;
        max-width: 1120px;
        width: 100%;
        margin: 0 auto;
      }
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
        border-bottom: 1px solid #eef0f3;
        padding: 6px 2px 14px;
      }
      .community-summary-label {
        margin: 0 0 3px;
        color: #6b7280;
        font-size: 13px;
        font-weight: 600;
      }
      .community-summary-title {
        color: #111827;
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
        border: 1px solid #edf0f3;
        border-radius: 999px;
        background: transparent;
        color: #6b7280;
        padding: 7px 9px;
        font-size: 12px;
        font-weight: 600;
      }
      .community-stat-pill strong {
        color: #111827;
      }
      .weekly-popular {
        margin: 2px 0 16px;
      }
      .weekly-popular-title {
        margin: 0 0 10px;
        font-size: 15px;
        font-weight: 700;
        color: #111827;
      }
      .weekly-popular-viewport {
        position: relative;
      }
      .weekly-edge {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 34px;
        pointer-events: none;
        z-index: 2;
        transition: opacity 0.3s ease;
      }
      .weekly-edge-right {
        right: 0;
        background: linear-gradient(to left, #ffffff 0%, rgba(255, 255, 255, 0) 100%);
      }
      .weekly-popular-track {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scroll-padding-left: 2px;
        padding: 2px 0 10px;
        scrollbar-width: none;
      }
      .weekly-popular-track::-webkit-scrollbar { display: none; }
      .weekly-popular-card {
        scroll-snap-align: start;
        flex: 0 0 82%;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-align: left;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid #eef0f3;
        background: #ffffff;
        cursor: pointer;
        transform-origin: center center;
        transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .weekly-popular-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .weekly-popular-rank {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #3787ff;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .weekly-popular-group {
        font-size: 12px;
        font-weight: 600;
        color: #8a909c;
      }
      .weekly-popular-card-title {
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .weekly-popular-card-content {
        font-size: 13px;
        color: #6b7280;
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
        color: #8a909c;
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
        background: #d7dce3;
        transition: width 0.2s ease, background 0.2s ease;
      }
      .weekly-dot.active {
        width: 18px;
        background: #3787ff;
      }
      .community-message {
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1d4ed8;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 500;
      }
      .community-post-list {
        display: grid;
        gap: 0;
      }
      .community-post-card {
        display: grid;
        gap: 10px;
        border-bottom: 1px solid #eef0f3;
        background: transparent;
        padding: 17px 2px 18px;
        cursor: pointer;
        animation: communityCardIn 0.22s ease both;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease, background 0.18s ease;
      }
      .community-post-card:hover {
        transform: translateX(2px);
        border-color: #d8dde5;
        background: #fafafa;
      }
      .community-post-card:focus-visible,
      .community-icon-button:focus-visible,
      .tabrail-item:focus-visible,
      .community-floating-write:focus-visible {
        outline: 2px solid #111827;
        outline-offset: 3px;
      }
      .community-post-head {
        display: grid;
        grid-template-columns: 38px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
      }
      .community-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #111827;
        font-size: 15px;
        font-weight: 700;
        overflow: hidden;
      }
      .community-avatar-img {
        width: 74%;
        height: 74%;
        object-fit: contain;
        display: block;
      }
      .community-post-author {
        margin: 0;
        color: #111827;
        font-size: 14px;
        font-weight: 700;
      }
      .community-post-date {
        margin: 2px 0 0;
        color: #9ca3af;
        font-size: 12px;
        font-weight: 500;
      }
      .community-group-badge {
        border-radius: 999px;
        background: #f3f4f6;
        color: #374151;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
      }
      .community-post-title {
        margin: 0;
        color: #111827;
        font-size: 18px;
        line-height: 1.35;
        font-weight: 700;
      }
      .community-post-content {
        margin: 0;
        color: #4b5563;
        font-size: 14px;
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
        border: 1px solid #eef0f3;
        background: #f9fafb;
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
        border: 1px solid #eef0f3;
        color: #6b7280;
        padding: 6px 9px;
        font-size: 12px;
        font-weight: 600;
      }
      .community-post-metrics {
        display: flex;
        gap: 12px;
        color: #6b7280;
        font-size: 13px;
        font-weight: 600;
      }
      .community-post-metrics span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .community-icon-button:active,
      .community-floating-write:active {
        transform: scale(0.97);
      }
      .community-search-input {
        animation: communitySearchIn 0.18s ease both;
      }
      .community-icon-button:hover {
        background: #f9fafb !important;
        border-color: #d1d5db !important;
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
        background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6);
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
          top: 92px;
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
          color: #9ca3af;
          font-size: 12px;
          font-weight: 700;
        }
        .community-post-card {
          padding: 20px 4px 21px;
        }
        .community-post-title {
          font-size: 19px;
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
const iconButtonStyle = {
  width: 40,
  height: 40,
  border: "1px solid #E5E7EB",
  borderRadius: 999,
  background: "#fff",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "12px 13px",
  color: "#111827",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

const searchStyle = {
  ...inputStyle,
  maxWidth: 1120,
  margin: "0 auto",
  background: "#fff",
} as const;

const emptyPanelStyle = {
  display: "grid",
  gap: 12,
  borderTop: "1px solid #EEF0F3",
  borderBottom: "1px solid #EEF0F3",
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
  background: "#111827",
  color: "#fff",
  padding: "13px 18px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(17,24,39,0.24)",
  zIndex: 55,
} as const;
