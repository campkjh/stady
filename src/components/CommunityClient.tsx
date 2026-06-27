"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  groupName: string;
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

export default function CommunityClient() {
  const router = useRouter();
  const topbarRef = useRef<HTMLElement | null>(null);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [filterTags, setFilterTags] = useState<CommunityTag[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [weeklyPosts, setWeeklyPosts] = useState<CommunityPost[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [topbarHeight, setTopbarHeight] = useState(0);
  const weeklyTrackRef = useRef<HTMLDivElement | null>(null);
  const [weeklyActiveIndex, setWeeklyActiveIndex] = useState(0);
  const [weeklyAtStart, setWeeklyAtStart] = useState(true);
  const [weeklyAtEnd, setWeeklyAtEnd] = useState(false);
  const scrollRestoredRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);

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
    if (!selectedGroupId) {
      setFilterTags([]);
      setSelectedTagId("");
      return;
    }
    loadTags(selectedGroupId, setFilterTags);
  }, [selectedGroupId]);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedTagId, query]);

  // 상세에서 돌아왔을 때(목록 첫 로드 완료 시점) 저장해둔 스크롤 위치로 복원.
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (loading || posts.length === 0) return; // 실제 목록이 렌더된 뒤에만 복원
    if (selectedGroupId || selectedTagId || query.trim()) {
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
      setGroups(ordered);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.");
    }
  }

  async function loadTags(groupId: string, setter: (tags: CommunityTag[]) => void) {
    try {
      const response = await fetch(`/api/tags?groupId=${encodeURIComponent(groupId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "태그를 불러오지 못했습니다.");
      setter(data.tags || []);
    } catch (error) {
      setter([]);
      setMessage(error instanceof Error ? error.message : "태그를 불러오지 못했습니다.");
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroupId) params.set("groupId", selectedGroupId);
      if (selectedTagId) params.set("tagId", selectedTagId);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
      setPosts(data.posts || []);
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
      if (response.ok) setWeeklyPosts(data.posts || []);
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
    setWeeklyAtStart(track.scrollLeft <= 4);
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
      <header ref={topbarRef} className="community-topbar">
        <div className="community-topbar-inner">
          <div>
            <h1 className="community-title">커뮤니티</h1>
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
          {selectedGroupId && (
            <TagChips
              tags={filterTags}
              selectedTagId={selectedTagId}
              onSelect={(id) => setSelectedTagId(id)}
            />
          )}
        </div>
      </header>

      <div className="community-layout">
        <aside className="community-filter-panel">
          <div className="community-filter-block">
            <p className="community-filter-title">카테고리</p>
            <CategoryChips
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={(id) => setSelectedGroupId(id)}
              stacked
            />
          </div>
          {selectedGroupId && (
            <div className="community-filter-block">
              <p className="community-filter-title">태그</p>
              <TagChips
                tags={filterTags}
                selectedTagId={selectedTagId}
                onSelect={(id) => setSelectedTagId(id)}
                stacked
              />
            </div>
          )}
        </aside>

        <section className="community-feed">
          {message && (
            <div className="community-message">
              {message}
            </div>
          )}

          {!selectedGroupId && !selectedTagId && !query.trim() && weeklyPosts.length > 0 && (
            <section className="weekly-popular" aria-label="주간 인기글">
              <h2 className="weekly-popular-title">
                <img src="/icons/medal.svg" alt="" width={18} height={18} style={{ verticalAlign: "-3px", marginRight: 4 }} />
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
                    style={{ transform: index === weeklyActiveIndex ? "scale(1)" : "scale(0.9)" }}
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
                <div className="weekly-edge weekly-edge-left" aria-hidden="true" style={{ opacity: weeklyAtStart ? 0 : 1 }} />
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
                    <div className="community-avatar" aria-hidden="true">{post.nickname.slice(0, 1)}</div>
                    <div>
                      <p className="community-post-author">{post.nickname}</p>
                      <p className="community-post-date">{new Date(post.createdAt).toLocaleString("ko-KR")}</p>
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
                      <HeartIcon /> 공감 {post.likeCount || 0}
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

      <button
        type="button"
        className="community-floating-write"
        onClick={() => router.push("/community/write")}
        style={floatingWriteButtonStyle}
      >
        게시글 +
      </button>
      <CommunityStyles />
    </main>
  );
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
  return (
    <div className={stacked ? "community-chip-column" : "community-chip-row"}>
      <button type="button" className="community-chip" onClick={() => onSelect("")} style={chipStyle(!selectedGroupId, stacked)}>
        전체
      </button>
      {groups.map((group) => (
        <button key={group.id} type="button" className="community-chip" onClick={() => onSelect(group.id)} style={chipStyle(selectedGroupId === group.id, stacked)}>
          {group.name}
        </button>
      ))}
    </div>
  );
}

function TagChips({
  tags,
  selectedTagId,
  onSelect,
  stacked = false,
}: {
  tags: CommunityTag[];
  selectedTagId: string;
  onSelect: (id: string) => void;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "community-chip-column" : "community-chip-row community-tag-row"}>
      <button type="button" className="community-chip" onClick={() => onSelect("")} style={tagChipStyle(!selectedTagId, stacked)}>
        전체 태그
      </button>
      {tags.map((tag) => (
        <button key={tag.id} type="button" className="community-chip" onClick={() => onSelect(tag.id)} style={tagChipStyle(selectedTagId === tag.id, stacked)}>
          #{tag.name}
        </button>
      ))}
    </div>
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
        background: rgba(255, 255, 255, 0.88);
        border-bottom: 1px solid rgba(229, 231, 235, 0.8);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
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
      .weekly-edge-left {
        left: 0;
        background: linear-gradient(to right, #ffffff 0%, rgba(255, 255, 255, 0) 100%);
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
        background: linear-gradient(160deg, #ffffff, #f6f9ff);
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
      .community-chip:focus-visible,
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
      .community-chip-row {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 1px 1px 3px;
        scrollbar-width: none;
      }
      .community-chip-row::-webkit-scrollbar {
        display: none;
      }
      .community-chip-column {
        display: grid;
        gap: 8px;
      }
      .community-chip {
        transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
      }
      .community-chip:hover {
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07);
      }
      .community-chip:active,
      .community-icon-button:active,
      .community-floating-write:active {
        transform: scale(0.97);
      }
      .community-search-input,
      .community-tag-row {
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
        .community-layout {
          grid-template-columns: 248px minmax(0, 1fr);
          align-items: start;
          gap: 28px;
          padding: 22px 24px;
        }
        .community-filter-panel {
          position: sticky;
          top: 92px;
          display: grid;
          gap: 14px;
          border-right: 1px solid #eef0f3;
          background: transparent;
          padding: 4px 18px 4px 0;
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

function chipStyle(active: boolean, stacked: boolean) {
  return {
    width: stacked ? "100%" : undefined,
    flex: "0 0 auto",
    border: `1px solid ${active ? "#111827" : "#E5E8EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#E5E8EB",
    color: active ? "#fff" : "#4E5968",
    padding: stacked ? "10px 12px" : "9px 13px",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    textAlign: "left",
  } as const;
}

function tagChipStyle(active: boolean, stacked: boolean) {
  return {
    width: stacked ? "100%" : undefined,
    flex: "0 0 auto",
    border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#4B5563",
    padding: stacked ? "9px 12px" : "8px 11px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  } as const;
}

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

const floatingWriteButtonStyle = {
  position: "fixed",
  right: "max(18px, calc((100vw - 720px) / 2 + 18px))",
  bottom: "calc(98px + env(safe-area-inset-bottom, 0px))",
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
