"use client";

import { useEffect, useState } from "react";
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
}

const TABS = [
  { label: "전체", value: "" },
  { label: "문제집", value: "workbook" },
  { label: "OX퀴즈", value: "ox" },
  { label: "영단어", value: "vocab" },
];

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

  function getQuizTypeLabel(quizType: string) {
    switch (quizType) {
      case "workbook":
        return "문제집";
      case "ox":
        return "OX퀴즈";
      case "vocab":
        return "영단어";
      default:
        return quizType;
    }
  }

  function getQuizTypeColor(quizType: string) {
    switch (quizType) {
      case "workbook":
        return "bg-blue-100 text-blue-700";
      case "ox":
        return "bg-green-100 text-green-700";
      case "vocab":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function handleNavigate(bookmark: Bookmark) {
    if (bookmark.quizType === "workbook" && bookmark.workbookId) {
      router.push(`/workbook/${bookmark.workbookId}`);
    } else if (bookmark.quizType === "ox" && bookmark.oxQuizSetId) {
      router.push(`/ox-quiz/${bookmark.oxQuizSetId}`);
    } else if (bookmark.quizType === "vocab" && bookmark.vocabQuizSetId) {
      router.push(`/vocab-quiz/${bookmark.vocabQuizSetId}`);
    }
  }

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
        <div className="grid grid-cols-2 gap-3">
          {bookmarks.map((bookmark) => (
            <button
              key={bookmark.id}
              onClick={() => handleNavigate(bookmark)}
              className="flex flex-col items-start rounded-xl border border-[#E5E7EB] bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              <span
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getQuizTypeColor(
                  bookmark.quizType
                )}`}
              >
                {getQuizTypeLabel(bookmark.quizType)}
              </span>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                {bookmark.subtitle || bookmark.title || "문제"}
              </p>
              {bookmark.subtitle && bookmark.title && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                  {bookmark.title}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {new Date(bookmark.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
