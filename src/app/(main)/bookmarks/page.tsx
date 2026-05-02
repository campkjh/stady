"use client";

import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { useRouter } from "next/navigation";
import LoginRequired from "@/components/LoginRequired";

interface Bookmark {
  id: string;
  quizType: string;
  workbookId: string | null;
  oxQuizSetId: string | null;
  vocabQuizSetId: string | null;
  problemId: string | null;
  oxQuestionId: string | null;
  vocabQuestionId: string | null;
  createdAt: string;
  title: string;
  subtitle: string;
  word: string | null;
  meaning: string | null;
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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    if (isLoggedIn === false) return;
    async function fetchBookmarks() {
      setLoading(true);
      try {
        const query = activeTab ? `?quizType=${activeTab}` : "";
        const res = await fetch(`/api/bookmarks${query}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setBookmarks(data.bookmarks ?? []);
      } catch {
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    }
    fetchBookmarks();
  }, [activeTab, isLoggedIn]);

  if (isLoggedIn === false) return <LoginRequired />;

  function handleNavigate(bookmark: Bookmark) {
    const targetId = bookmark.problemId || bookmark.oxQuestionId || bookmark.vocabQuestionId;
    const query = new URLSearchParams({ type: bookmark.quizType });
    if (targetId) query.set("id", targetId);
    router.push(`/wrong-note?${query.toString()}`);
  }

  async function handleDeleteVocabBookmark(bookmark: Bookmark) {
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
    try {
      const res = await fetch(`/api/bookmarks?id=${bookmark.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch {
      setBookmarks((prev) => [bookmark, ...prev]);
    }
  }

  // Split: vocab vs others
  const vocabBookmarks = bookmarks.filter((b) => b.quizType === "vocab");
  const otherBookmarks = bookmarks.filter((b) => b.quizType !== "vocab");

  return (
    <div className="px-4 pt-6">
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", paddingBottom: 8 }}>
        <h1 className="text-xl font-bold mb-4">찜</h1>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
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
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
