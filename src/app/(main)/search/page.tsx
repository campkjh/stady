"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Workbook {
  id: string;
  title: string;
  thumbnail: string | null;
  categoryId: string;
  totalQuestions: number;
  questionPerPage: number;
  category: Category;
}

const GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-cyan-600",
];

function getGradient(index: number) {
  return GRADIENTS[index % GRADIENTS.length];
}

const POPULAR_KEYWORDS = [
  "생활과 윤리", "수학", "영어", "사회문화", "한국지리",
  "세계지리", "윤리와사상", "정치와법", "경제", "세계사",
];

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
    const saved = localStorage.getItem("recentSearches");
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const addRecentSearch = useCallback((keyword: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((k) => k !== keyword);
      const updated = [keyword, ...filtered].slice(0, 10);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((keyword: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((k) => k !== keyword);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  }, []);

  const doSearch = useCallback((keyword: string) => {
    setQuery(keyword);
    addRecentSearch(keyword);
    setLoading(true);
    setSearched(true);
    fetch(`/api/workbooks?search=${encodeURIComponent(keyword.trim())}`)
      .then((res) => res.json())
      .then((data) => setResults(data.workbooks || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [addRecentSearch]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      doSearch(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const showDefault = !searched && !loading;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      {/* Search Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="press"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, flexShrink: 0, background: "none", border: "none" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 12, color: "#9CA3AF" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어를 입력해주세요."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              backgroundColor: "#F9FAFB",
              padding: "10px 40px 10px 40px",
              fontSize: 14,
              color: "#111",
              outline: "none",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="press"
              style={{
                position: "absolute",
                right: 12,
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#D1D5DB",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Default: 최근검색어 + 인기검색어 */}
      {showDefault && (
        <div style={{ padding: "0 10px" }}>
          {/* 최근 검색어 */}
          <div style={{ paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>최근 검색어</h3>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllRecent}
                  className="press"
                  style={{ fontSize: 13, color: "#9CA3AF", background: "none", border: "none" }}
                >
                  전체 삭제
                </button>
              )}
            </div>
            {recentSearches.length === 0 ? (
              <p style={{ fontSize: 14, color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>
                최근 검색어가 없습니다.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {recentSearches.map((keyword) => (
                  <div
                    key={keyword}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 20,
                      backgroundColor: "#F3F4F6",
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => doSearch(keyword)}
                      className="press"
                      style={{ background: "none", border: "none", color: "#374151", fontSize: 13 }}
                    >
                      {keyword}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentSearch(keyword)}
                      style={{ background: "none", border: "none", display: "flex", alignItems: "center", padding: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />

          {/* 인기 검색어 */}
          <div style={{ paddingTop: 20, paddingBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 16 }}>인기 검색어</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {POPULAR_KEYWORDS.map((keyword, idx) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => doSearch(keyword)}
                  className="press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 4px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid #F9FAFB",
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: idx < 3 ? "#4A90D9" : "#9CA3AF",
                    width: 20,
                    textAlign: "center",
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 14, color: "#111", fontWeight: 400 }}>
                    {keyword}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!showDefault && (
        <div style={{ padding: "16px 10px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#4A90D9]" />
            </div>
          ) : searched && results.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "#9CA3AF" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p style={{ marginTop: 12, fontSize: 14 }}>검색 결과가 없습니다</p>
            </div>
          ) : results.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {results.map((wb, i) => (
                <button
                  key={wb.id}
                  type="button"
                  onClick={() => router.push(`/workbook/${wb.id}`)}
                  className="hover-lift"
                  style={{ textAlign: "left", background: "none", border: "none" }}
                >
                  <div
                    className={`flex items-center justify-center bg-gradient-to-br ${getGradient(i)}`}
                    style={{ aspectRatio: "1/1", borderRadius: 12 }}
                  >
                    <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                      {wb.title.charAt(0)}
                    </span>
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {wb.title}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {wb.totalQuestions}문항/{wb.questionPerPage}문항
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
