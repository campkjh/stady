"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

interface Workbook {
  id: string;
  title: string;
  thumbnail: string | null;
  categoryId: string;
  totalQuestions: number;
  questionPerPage: number;
}

const GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-cyan-600",
];

function getGradient(i: number) {
  return GRADIENTS[i % GRADIENTS.length];
}

function CategoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryId = searchParams.get("id");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialCategoryId);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = selectedId ? `?categoryId=${selectedId}` : "";
    fetch(`/api/workbooks${params}`)
      .then((r) => r.json())
      .then((data) => setWorkbooks(data.workbooks || []))
      .catch(() => setWorkbooks([]))
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div style={{ width: "100%", overflow: "hidden", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
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
          <input
            type="text"
            readOnly
            onClick={() => router.push("/search")}
            placeholder="검색어를 입력해주세요."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              backgroundColor: "#F9FAFB",
              padding: "10px 16px",
              fontSize: 14,
              color: "#9CA3AF",
              outline: "none",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* Category Tabs - 가로 스크롤 */}
      <div style={{ overflowX: "auto", overflowY: "hidden", padding: "8px 10px 16px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
          {categories.map((cat) => {
            const isAll = cat.name === "전체";
            const isSelected = isAll ? selectedId === null : selectedId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedId(isAll ? null : cat.id)}
                className="press"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  flexShrink: 0,
                  width: 72,
                }}
              >
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: isSelected ? "#EBF0FF" : "#F2F2F6",
                  border: isSelected ? "2px solid #4A90D9" : "1px solid #F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}>
                  {cat.icon.startsWith("/") ? (
                    <img src={cat.icon} alt={cat.name} style={{ width: 36, height: 36, objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  )}
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "#4A90D9" : "#374151",
                  transition: "all 0.2s ease",
                }}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#4A90D9]" />
        </div>
      ) : workbooks.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "#9CA3AF" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p style={{ marginTop: 12, fontSize: 14 }}>등록된 문제집이 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "0 10px 20px" }}>
          {workbooks.map((wb, i) => (
            <button
              key={wb.id}
              type="button"
              onClick={() => router.push(`/workbook/${wb.id}`)}
              className="hover-lift"
              style={{ textAlign: "left", background: "none", border: "none" }}
            >
              <div style={{
                aspectRatio: "3/4",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#3787FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {wb.thumbnail ? (
                  <img src={wb.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src="/icons/book-cover.svg" alt="" style={{ width: "60%", opacity: 0.8 }} />
                )}
              </div>
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {wb.title}
                </p>
                <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                  {wb.totalQuestions}문항
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#4A90D9]" />
      </div>
    }>
      <CategoryContent />
    </Suspense>
  );
}
