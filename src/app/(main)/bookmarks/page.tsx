"use client";

import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";
import { clientCache } from "@/lib/clientCache";

const bmKey = (tab: string) => `bookmarks:${tab}`;

interface Bookmark {
  id: string;
  quizType: string;
  workbookId: string | null;
  oxQuizSetId: string | null;
  vocabQuizSetId: string | null;
  problemId: string | null;
  oxQuestionId: string | null;
  vocabQuestionId: string | null;
  memo: string | null;
  drawing: string | null;
  createdAt: string;
  title: string;
  subtitle: string;
  word: string | null;
  meaning: string | null;
  categoryName: string;
}

const TABS = [
  { label: "전체", value: "" },
  { label: "문제집", value: "workbook" },
  { label: "OX퀴즈", value: "ox" },
  { label: "영단어", value: "vocab" },
];

function SwipeableVocabBookmarkItem({
  bookmark,
  isLast,
  onNavigate,
  onDelete,
}: {
  bookmark: Bookmark;
  isLast: boolean;
  onNavigate: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);
  const maxOffset = -88;

  function handleTouchStart(e: TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    movedRef.current = false;
    setIsDragging(true);
  }

  function handleTouchMove(e: TouchEvent) {
    const diff = e.touches[0].clientX - startXRef.current;
    if (Math.abs(diff) > 6) movedRef.current = true;
    if (diff < 0) {
      setOffsetX(Math.max(maxOffset, diff));
    } else if (offsetX < 0) {
      setOffsetX(Math.min(0, maxOffset + diff));
    }
  }

  function handleTouchEnd() {
    setIsDragging(false);
    setOffsetX(offsetX < -44 ? maxOffset : 0);
  }

  function handleClick() {
    if (movedRef.current) return;
    if (offsetX < 0) {
      setOffsetX(0);
      return;
    }
    onNavigate(bookmark);
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderBottom: isLast ? "none" : "1px solid #F3F4F6",
        background: "#EF4444",
      }}
    >
      <button
        type="button"
        onClick={() => onDelete(bookmark)}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 88,
          border: "none",
          background: "#EF4444",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        삭제
      </button>
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="press"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "14px 16px",
          background: "#fff",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.18s ease",
          touchAction: "pan-y",
        }}
      >
        <span style={{
          flex: 1, fontSize: 15, fontWeight: 700, color: "#111",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {bookmark.word || bookmark.subtitle}
        </span>
        <span style={{
          flex: 1, fontSize: 14, color: "#6B7280", textAlign: "right",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          paddingLeft: 12,
        }}>
          {bookmark.meaning || ""}
        </span>
      </button>
    </div>
  );
}

export default function BookmarksPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("");
  const [oxCategory, setOxCategory] = useState(""); // OX 분류(카테고리) 필터
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => clientCache.get<Bookmark[]>(bmKey("")) ?? []);
  const [loading, setLoading] = useState(() => !clientCache.has(bmKey("")));
  const [deletingAll, setDeletingAll] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // 나갔다 다시 들어와도 선택했던 탭/분류가 유지되도록 복원
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("bookmark_tab");
      const savedCat = localStorage.getItem("bookmark_ox_category");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedTab) setActiveTab(savedTab);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedCat) setOxCategory(savedCat);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn === false) return;
    async function fetchBookmarks() {
      const key = bmKey(activeTab);
      // 캐시가 있으면 즉시 표시, 로딩 생략(백그라운드 재검증).
      const cached = clientCache.get<Bookmark[]>(key);
      if (cached) {
        setBookmarks(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const query = activeTab ? `?quizType=${activeTab}` : "";
        const res = await fetch(`/api/bookmarks${query}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const fresh = data.bookmarks ?? [];
        if (clientCache.set(key, fresh)) setBookmarks(fresh);
      } catch {
        if (!cached) setBookmarks([]);
      } finally {
        setLoading(false);
      }
    }
    fetchBookmarks();
  }, [activeTab, isLoggedIn]);

  if (isLoggedIn === false) return <LoginRequired />;

  function handleNavigate(bookmark: Bookmark) {
    const targetId = bookmark.problemId || bookmark.oxQuestionId || bookmark.vocabQuestionId;
    const query = new URLSearchParams({ bookmark: "1" });
    if (targetId) query.set("id", targetId);

    if (bookmark.quizType === "workbook" && bookmark.workbookId) {
      router.push(`/workbook/${bookmark.workbookId}/solve?${query.toString()}`);
    } else if (bookmark.quizType === "ox" && bookmark.oxQuizSetId) {
      router.push(`/ox-quiz/${bookmark.oxQuizSetId}?${query.toString()}`);
    } else if (bookmark.quizType === "vocab" && bookmark.vocabQuizSetId) {
      router.push(`/vocab-quiz/${bookmark.vocabQuizSetId}?${query.toString()}`);
    }
  }

  async function handleDeleteVocabBookmark(bookmark: Bookmark) {
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
    clientCache.clearPrefix("bookmarks:");
    try {
      const res = await fetch(`/api/bookmarks?id=${bookmark.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch {
      setBookmarks((prev) => [bookmark, ...prev]);
    }
  }

  async function handleDeleteAllBookmarks() {
    if (deletingAll || bookmarks.length === 0) return;
    if (!window.confirm("모든 책갈피를 취소할까요?")) return;

    const previousBookmarks = bookmarks;
    setDeletingAll(true);
    setBookmarks([]);
    clientCache.clearPrefix("bookmarks:");
    try {
      const res = await fetch("/api/bookmarks?all=true", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete all");
    } catch {
      setBookmarks(previousBookmarks);
      alert("책갈피를 모두 취소하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingAll(false);
    }
  }

  // OX 분류(카테고리) 목록 — OX 탭에서 필터 칩으로 사용
  const oxCategories = Array.from(
    new Set(
      bookmarks
        .filter((b) => b.quizType === "ox" && b.categoryName)
        .map((b) => b.categoryName)
    )
  );

  // Split: vocab vs others
  const vocabBookmarks = bookmarks.filter((b) => b.quizType === "vocab");
  const otherBookmarks = bookmarks
    .filter((b) => b.quizType !== "vocab")
    // OX 탭에서 분류가 선택되면 해당 분류만 노출
    .filter((b) => !(activeTab === "ox" && oxCategory) || b.categoryName === oxCategory);

  return (
    <div className="px-4 pt-6">
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h1 className="text-xl font-bold" style={{ margin: 0 }}>찜</h1>
          {!loading && bookmarks.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllBookmarks}
              disabled={deletingAll}
              className="press"
              style={{
                border: "1px solid #FCA5A5",
                borderRadius: 999,
                background: deletingAll ? "#FEE2E2" : "#fff",
                color: "#DC2626",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 800,
                cursor: deletingAll ? "not-allowed" : "pointer",
                opacity: deletingAll ? 0.64 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {deletingAll ? "취소 중..." : "모든 책갈피 취소"}
            </button>
          )}
        </div>
      </div>

      {/* Tab filters */}
      <div className={`flex gap-2 overflow-x-auto ${activeTab === "ox" && oxCategories.length > 0 ? "mb-3" : "mb-6"}`}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              setOxCategory("");
              try {
                localStorage.setItem("bookmark_tab", tab.value);
                localStorage.setItem("bookmark_ox_category", "");
              } catch {}
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-gray-900 text-white"
                : "border border-[#E5E7EB] bg-white text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OX 분류(카테고리) 필터 — 메인 탭(알약)과 구분되는 언더라인 탭 스타일 */}
      {activeTab === "ox" && oxCategories.length > 0 && (
        <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid #EFF1F4" }}>
          {[{ label: "전체", value: "" }, ...oxCategories.map((c) => ({ label: c, value: c }))].map((c) => {
            const active = oxCategory === c.value;
            return (
              <button
                key={c.value || "__all"}
                onClick={() => {
                  setOxCategory(c.value);
                  try { localStorage.setItem("bookmark_ox_category", c.value); } catch {}
                }}
                className="shrink-0"
                style={{
                  padding: "8px 12px 11px",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2.5px solid #3787FF" : "2.5px solid transparent",
                  marginBottom: -1,
                  fontSize: 14,
                  fontWeight: active ? 800 : 600,
                  color: active ? "#3787FF" : "#9CA3AF",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "color 0.15s ease",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Re-test all collected questions of the active tab at once */}
      {!loading && bookmarks.length > 0 && (
        <button
          type="button"
          onClick={() => router.push(`/retest?source=bookmark&type=${activeTab || "all"}`)}
          className="press"
          style={{
            width: "100%", height: 52, borderRadius: 14, border: "none", marginBottom: 20,
            background: "#3787FF", color: "#fff", fontSize: 15, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 6px 18px rgba(55,135,255,0.28)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9" />
            <polyline points="3 4 3 9 8 9" />
          </svg>
          찜한 문제 한번에 풀기
        </button>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <img src="/icons/notebook.svg" alt="" style={{ width: 52, height: 52, marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 4 }}>책갈피가 없어요</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>책갈피에 다양한 문제집을 넣어보세요!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 16 }}>
          {/* Vocab section: en | ko list */}
          {vocabBookmarks.length > 0 && (
            <div style={{
              borderRadius: 14, border: "1px solid #F3F4F6",
              background: "#fff", overflow: "hidden",
            }}>
              {vocabBookmarks.map((bm, i) => (
                <SwipeableVocabBookmarkItem
                  key={bm.id}
                  bookmark={bm}
                  isLast={i === vocabBookmarks.length - 1}
                  onNavigate={handleNavigate}
                  onDelete={handleDeleteVocabBookmark}
                />
              ))}
            </div>
          )}

          {/* Others section: card grid */}
          {otherBookmarks.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {otherBookmarks.map((bookmark) => (
                <button
                  key={bookmark.id}
                  onClick={() => handleNavigate(bookmark)}
                  className="flex flex-col items-start rounded-xl border border-[#E5E7EB] bg-white p-4 text-left transition-shadow hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {bookmark.subtitle || bookmark.title || "문제"}
                  </p>
                  {bookmark.subtitle && bookmark.title && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                      {bookmark.title}
                    </p>
                  )}
                  {bookmark.memo && (
                    <p className="mt-2 w-full whitespace-pre-wrap rounded-lg bg-[#F8F9FB] p-2 text-xs text-gray-600 line-clamp-3">
                      📝 {bookmark.memo}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
