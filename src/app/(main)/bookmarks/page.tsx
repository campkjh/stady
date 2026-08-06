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

// 탭 아이콘은 앱에 이미 있는 SVG를 그대로 쓴다(비활성은 회색조로 눌러 표시).
// size: 파일마다 내부 여백·비율이 달라 같은 24px로 그리면 보이는 크기가 제각각이다.
// (실측 잉크 크기 @24px — 전체 8.3, 문제집 20.4, OX 18.2×12.6, 영단어 22.2×13.5)
// 문제집을 기준으로 '넓이×높이의 기하평균'이 같아지도록 파일별 렌더 크기를 맞췄다.
const TABS = [
  { label: "전체", value: "", icon: "/icons/전체.svg", size: 56 },
  { label: "문제집", value: "workbook", icon: "/icons/notebook.svg", size: 24 },
  { label: "OX퀴즈", value: "ox", icon: "/icons/banner-ox.svg", size: 31 },
  { label: "영단어", value: "vocab", icon: "/icons/banner-vocab.svg", size: 27 },
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
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // 진입 시엔 항상 "전체"로 시작해 모든 카테고리 책갈피를 한 번에 보여준다.
  // (예전엔 마지막 선택 탭/분류를 복원해, 여러 카테고리에 책갈피가 있으면 한 카테고리만
  //  보여 매번 필터를 바꿔야 하는 불편이 있었다.)

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
    // 확인은 인앱 모달에서 받는다(WebView는 window.confirm이 동작하지 않음).
    if (deletingAll || bookmarks.length === 0) return;
    setShowDeleteAllConfirm(false);

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

  // OX는 카테고리별, 문제집은 한 묶음으로 그룹핑해 여러 카테고리 책갈피를 한 화면에서 모두 본다.
  const otherGroups = (() => {
    const order: string[] = [];
    const map = new Map<string, Bookmark[]>();
    for (const b of otherBookmarks) {
      const key = b.quizType === "ox" ? (b.categoryName || "OX퀴즈") : "문제집";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(b);
    }
    return order.map((key) => ({ key, items: map.get(key)! }));
  })();

  return (
    <div className="px-4 pt-6">
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h1 className="text-xl font-bold" style={{ margin: 0 }}>책갈피</h1>
          {!loading && bookmarks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllConfirm(true)}
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
      <div className={`tabrail is-illustrated ${activeTab === "ox" && oxCategories.length > 0 ? "mb-3" : "mb-6"}`}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setActiveTab(tab.value);
              setOxCategory("");
            }}
            className={`tabrail-item${activeTab === tab.value ? " is-on" : ""}`}
            aria-current={activeTab === tab.value ? "true" : undefined}
          >
            <span className="tabrail-ico">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tab.icon} alt="" width={tab.size} height={tab.size} />
            </span>
            <span className="tabrail-label">{tab.label}</span>
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
                onClick={() => setOxCategory(c.value)}
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

      {/* Re-test all collected questions of the active tab at once — 토스 스타일 카드 */}
      {!loading && bookmarks.length > 0 && (
        <button
          type="button"
          onClick={() => router.push(`/retest?source=bookmark&type=${activeTab || "all"}`)}
          className="press"
          style={{
            position: "relative",
            width: "100%",
            minHeight: 128,
            borderRadius: 20,
            border: "none",
            marginBottom: 20,
            padding: "20px 18px",
            background: "linear-gradient(115deg, #F2F6FC 0%, #F4F3FB 62%, #F3EFFA 100%)",
            textAlign: "left",
            overflow: "hidden",
            display: "block",
            cursor: "pointer",
          }}
        >
          {/* 우측 동심원 장식 — 프리즘 라이트 트레인(테두리를 따라 빛이 흐르고 블러로 퍼짐) */}
          <span aria-hidden className="bm-ring" style={{ top: -44, right: -30, width: 200, height: 200 }}>
            <span className="bm-ring-glow" />
            <span className="bm-ring-train" />
          </span>
          <span aria-hidden className="bm-ring bm-ring-rev" style={{ top: -8, right: 6, width: 128, height: 128 }}>
            <span className="bm-ring-glow" />
            <span className="bm-ring-train" />
          </span>

          {/* 우측 아이콘 + 플로팅 칩 */}
          <span aria-hidden style={{ position: "absolute", top: 24, right: 18, width: 96, height: 96, pointerEvents: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/bookmark-book3d.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 8px 16px rgba(101,111,255,0.25))" }} />
            <span style={{
              position: "absolute", top: -12, right: -6,
              padding: "5px 10px", borderRadius: 999, background: "#fff",
              color: "#4B5563", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
            }}>모아 풀기</span>
          </span>

          {/* 좌측 텍스트 */}
          <span style={{ position: "relative", display: "block", paddingRight: 118 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#6B7CF7", marginBottom: 6 }}>
              모아둔 문제 복습
            </span>
            <span style={{ display: "block", fontSize: 17.5, fontWeight: 800, color: "#26282E", lineHeight: 1.38, letterSpacing: -0.2 }}>
              책갈피한 문제만<br />한번에 풀어보는 복습
            </span>
          </span>

          {/* 우하단 원형 화살표 */}
          <span aria-hidden style={{
            position: "absolute", right: 18, bottom: 16,
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
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

          {/* Others section: 카테고리(OX)/문제집별 그룹 + 카드 그리드 */}
          {otherGroups.map((group) => (
            <div key={group.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 2px 10px" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>{group.key}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>{group.items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {group.items.map((bookmark) => (
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
                    {(bookmark.memo || bookmark.drawing) && (
                      // 퀴즈 노트: 노란 메모지 느낌으로 글/그림을 함께 보여준다.
                      <div className="mt-2 w-full rounded-lg p-2" style={{ background: "#FFF8B8", border: "1px solid #EFE39A" }}>
                        {bookmark.memo && (
                          <p className="whitespace-pre-wrap text-xs line-clamp-3" style={{ color: "#4A4224" }}>
                            {bookmark.memo}
                          </p>
                        )}
                        {bookmark.drawing && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={bookmark.drawing}
                            alt="노트 그림"
                            className={bookmark.memo ? "mt-1.5" : ""}
                            style={{ width: "100%", borderRadius: 6, background: "rgba(255,255,255,0.5)" }}
                          />
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 프리즘 라이트 트레인 링: conic 세그먼트를 radial 마스크로 얇은 링만 남기고 회전.
          glow(두꺼운 링+blur)가 아래에서 은은하게 번지고, train(얇은 링)이 또렷한 빛줄기. */}
      <style>{`
        .bm-ring {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
        }
        .bm-ring::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1.5px solid rgba(122, 132, 255, 0.15);
        }
        .bm-ring-glow, .bm-ring-train {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: conic-gradient(from 0deg,
            transparent 0deg, transparent 260deg,
            rgba(142, 197, 255, 0) 272deg,
            rgba(142, 197, 255, 0.9) 300deg,
            rgba(196, 168, 255, 1) 320deg,
            rgba(255, 255, 255, 0.95) 332deg,
            rgba(246, 183, 255, 0.9) 342deg,
            rgba(159, 224, 255, 0) 356deg,
            transparent 360deg);
          animation: bmRingSpin 5.2s linear infinite;
        }
        .bm-ring-train {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.6px), #000 calc(100% - 1.2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2.6px), #000 calc(100% - 1.2px));
        }
        .bm-ring-glow {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 1px));
          filter: blur(5px);
          opacity: 0.9;
        }
        .bm-ring-rev .bm-ring-glow, .bm-ring-rev .bm-ring-train {
          animation-duration: 4.1s;
          animation-direction: reverse;
        }
        @keyframes bmRingSpin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bm-ring-glow, .bm-ring-train { animation: none; }
        }
      `}</style>

      {/* 모든 책갈피 취소 확인 모달 (WebView에서 window.confirm 미동작 → 인앱 모달) */}
      {showDeleteAllConfirm && (
        <div
          onClick={() => setShowDeleteAllConfirm(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15,23,42,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 320, background: "#fff", borderRadius: 18,
              padding: "22px 20px 16px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 800, color: "#191F28", margin: "0 0 6px", textAlign: "center" }}>
              모든 책갈피 취소
            </p>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 20px", textAlign: "center", lineHeight: 1.5 }}>
              찜한 모든 문제의 책갈피를 취소할까요?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(false)}
                style={{
                  flex: 1, height: 48, borderRadius: 12, border: "1px solid #E5E7EB",
                  background: "#fff", color: "#4B5563", fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAllBookmarks}
                style={{
                  flex: 1, height: 48, borderRadius: 12, border: "none",
                  background: "#EF4444", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
