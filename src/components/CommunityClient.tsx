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
  createdAt: string;
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
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [topbarHeight, setTopbarHeight] = useState(0);

  useEffect(() => {
    loadGroups();
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

  async function loadGroups() {
    try {
      const response = await fetch("/api/category-groups");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "카테고리를 불러오지 못했습니다.");
      setGroups(data.groups || []);
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

  function openPost(postId: string) {
    router.push(`/community/${postId}`);
  }

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );
  const selectedTag = useMemo(
    () => filterTags.find((tag) => tag.id === selectedTagId),
    [filterTags, selectedTagId]
  );
  const totalLikes = useMemo(() => posts.reduce((sum, post) => sum + (post.likeCount || 0), 0), [posts]);
  const totalComments = useMemo(() => posts.reduce((sum, post) => sum + (post.commentCount || 0), 0), [posts]);

  return (
    <main className="community-page" style={{ "--community-header-height": `${topbarHeight}px` } as CSSProperties}>
      <header ref={topbarRef} className="community-topbar">
        <div className="community-topbar-inner">
          <div>
            <p className="community-eyebrow">STADY</p>
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
          <div className="community-feed-summary">
            <div>
              <p className="community-summary-label">{selectedTag ? `#${selectedTag.name}` : selectedGroup?.name || "전체"}</p>
              <strong className="community-summary-title">{posts.length}개의 글</strong>
            </div>
            <div className="community-summary-stats">
              <StatPill label="공감" value={totalLikes} />
              <StatPill label="댓글" value={totalComments} />
            </div>
          </div>

          {message && (
            <div className="community-message">
              {message}
            </div>
          )}

          <div className="community-post-list">
            {loading ? (
              <>
                <SkeletonPost />
                <SkeletonPost />
              </>
            ) : posts.length === 0 ? (
              <div style={emptyPanelStyle}>
                <p style={{ margin: 0, color: "#6B7280", fontSize: 14, fontWeight: 700 }}>아직 게시글이 없습니다.</p>
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
                  <h2 className="community-post-title">{post.title}</h2>
                  <p className="community-post-content">{post.content}</p>
                  {post.imageUrls.length > 0 && (
                    <div className={post.imageUrls.length === 1 ? "community-post-image-single" : "community-post-image-grid"}>
                      {post.imageUrls.slice(0, 4).map((imageUrl, index) => (
                        <div key={imageUrl} className="community-post-image-thumb">
                          <img src={imageUrl} alt={`${post.title} 이미지 ${index + 1}`} />
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="community-stat-pill">
      {label} <strong>{value}</strong>
    </span>
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
        width: min(100vw, 500px);
        max-width: 500px;
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
        font-weight: 900;
      }
      .community-title {
        margin: 0;
        color: #111827;
        font-size: 24px;
        font-weight: 900;
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
        font-weight: 800;
      }
      .community-summary-title {
        color: #111827;
        font-size: 20px;
        font-weight: 900;
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
        font-weight: 800;
      }
      .community-stat-pill strong {
        color: #111827;
      }
      .community-message {
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1d4ed8;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 700;
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
        font-weight: 900;
      }
      .community-post-author {
        margin: 0;
        color: #111827;
        font-size: 14px;
        font-weight: 900;
      }
      .community-post-date {
        margin: 2px 0 0;
        color: #9ca3af;
        font-size: 12px;
        font-weight: 700;
      }
      .community-group-badge {
        border-radius: 999px;
        background: #f3f4f6;
        color: #374151;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 900;
      }
      .community-post-title {
        margin: 0;
        color: #111827;
        font-size: 18px;
        line-height: 1.35;
        font-weight: 900;
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
        max-width: 520px;
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
        font-weight: 900;
      }
      .community-tag-badge {
        border-radius: 999px;
        background: transparent;
        border: 1px solid #eef0f3;
        color: #6b7280;
        padding: 6px 9px;
        font-size: 12px;
        font-weight: 800;
      }
      .community-post-metrics {
        display: flex;
        gap: 12px;
        color: #6b7280;
        font-size: 13px;
        font-weight: 800;
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
      @media (min-width: 900px) {
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
          font-weight: 900;
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
    border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
    borderRadius: 999,
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#374151",
    padding: stacked ? "10px 12px" : "9px 13px",
    fontSize: 14,
    fontWeight: 900,
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
    fontWeight: 800,
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
  right: "max(18px, calc((100vw - 500px) / 2 + 18px))",
  bottom: "calc(98px + env(safe-area-inset-bottom, 0px))",
  border: "none",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  padding: "13px 18px",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(17,24,39,0.24)",
  zIndex: 55,
} as const;
