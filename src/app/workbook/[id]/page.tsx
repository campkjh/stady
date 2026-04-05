"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface RankingEntry {
  userId: string;
  nickname: string;
  avatar: string | null;
  score: number;
  totalScore: number;
  timeTaken: number;
}

interface Problem {
  id: string;
  order: number;
  questionText: string | null;
}

interface Workbook {
  id: string;
  title: string;
  thumbnail: string | null;
  totalQuestions: number;
  questionPerPage: number;
  category: { id: string; name: string; icon: string };
  problems: Problem[];
}

interface ReviewUser {
  id: string;
  nickname: string;
  avatar: string | null;
}

interface Review {
  id: string;
  userId: string;
  rating: number;
  content: string;
  createdAt: string;
  user: ReviewUser;
}

export default function WorkbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [myAttemptCount, setMyAttemptCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/workbooks/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setWorkbook(data.workbook);
        setRanking(data.ranking || []);

        // Check login status & attempts
        const attemptRes = await fetch("/api/attempts");
        if (attemptRes.ok) {
          setIsLoggedIn(true);
          const attemptData = await attemptRes.json();
          const myAttempts = (attemptData.attempts || []).filter(
            (a: { workbookId: string }) => a.workbookId === id
          );
          if (myAttempts.length > 0) {
            setMyAttemptCount(myAttempts[0].score || 0);
            setHasCompleted(true);
          }
        }

        // Check bookmark status
        const bmRes = await fetch("/api/bookmarks?quizType=workbook");
        if (bmRes.ok) {
          const bmData = await bmRes.json();
          const isBookmarked = (bmData.bookmarks || []).some(
            (b: { workbookId: string | null }) => b.workbookId === id
          );
          setBookmarked(isBookmarked);
        }

        // Fetch reviews
        const reviewRes = await fetch(`/api/workbooks/${id}/reviews`);
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReviews(reviewData.reviews || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function handleBookmarkToggle() {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizType: "workbook", workbookId: id }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          showToast("로그인이 필요합니다.");
          return;
        }
        throw new Error("Failed");
      }
      const data = await res.json();
      setBookmarked(data.bookmarked);
      showToast(data.bookmarked ? "책갈피에 추가되었습니다" : "책갈피에서 제거되었습니다");
    } catch (err) {
      console.error(err);
      showToast("오류가 발생했습니다.");
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function handleReviewSubmit() {
    if (reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/workbooks/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, content: reviewContent }),
      });
      if (!res.ok) {
        const errData = await res.json();
        showToast(errData.error || "후기 작성에 실패했습니다.");
        return;
      }
      const data = await res.json();
      setReviews((prev) => [data.review, ...prev]);
      setShowReviewModal(false);
      setReviewRating(5);
      setReviewContent("");
      showToast("후기가 등록되었습니다.");
    } catch (err) {
      console.error(err);
      showToast("오류가 발생했습니다.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  const avgScore =
    ranking.length > 0
      ? Math.round(ranking.reduce((sum, r) => sum + r.score, 0) / ranking.length)
      : 0;
  const maxScore =
    ranking.length > 0 ? Math.max(...ranking.map((r) => r.score)) : 0;

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  function renderStars(rating: number, size: number = 14) {
    return (
      <span style={{ display: "inline-flex", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} width={size} height={size} viewBox="0 0 24 24" fill={star <= rating ? "#FBBF24" : "#E5E7EB"} stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </span>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="w-8 h-8 border-4 border-[#3787FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workbook) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <p style={{ color: "#9CA3AF" }}>문제집을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="press" style={{ color: "#3787FF", fontWeight: 600, background: "none", border: "none" }}>
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 8,
          fontSize: 14,
          zIndex: 9999,
          pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", display: "flex", alignItems: "center", padding: "12px 10px" }}>
        <button onClick={() => router.back()} className="press" style={{ padding: 4, background: "none", border: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Thumbnail */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <div style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "#3787FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {workbook.thumbnail ? (
            <img src={workbook.thumbnail} alt={workbook.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src="/icons/book-cover.svg" alt="" style={{ width: "40%", opacity: 0.8 }} />
          )}
        </div>
      </div>

      {/* Title & Info */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>
          {workbook.title}
        </h1>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>
          {myAttemptCount}문항/{workbook.totalQuestions}문항
        </p>
      </div>

      {/* Stats */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, backgroundColor: "#F9FAFB", borderRadius: 14, padding: "16px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>유저 평균점수</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{avgScore}점</p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F9FAFB", borderRadius: 14, padding: "16px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>최고점수</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: "#3787FF" }}>{maxScore}점</p>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div style={{ padding: "0 16px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>랭킹</h2>
        {ranking.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 14, padding: "32px 0" }}>
            아직 도전한 유저가 없습니다.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ranking.map((entry, index) => (
              <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 14, padding: "12px 16px" }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, width: 32, textAlign: "center",
                  color: index === 0 ? "#EAB308" : index === 1 ? "#9CA3AF" : index === 2 ? "#D97706" : "#6B7280",
                }}>
                  {index + 1}등
                </span>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#E5E7EB", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>
                <p style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.nickname}
                </p>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{entry.score}점</p>
                  <p style={{ fontSize: 12, color: "#9CA3AF" }}>{formatTime(entry.timeTaken)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div style={{ padding: "0 16px", marginBottom: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
            후기 ({reviews.length})
          </h2>
          {reviews.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {renderStars(Math.round(Number(avgRating)))}
              <span style={{ fontSize: 13, color: "#6B7280", marginLeft: 4 }}>{avgRating}</span>
            </div>
          )}
        </div>

        {!isLoggedIn ? (
          <div style={{
            textAlign: "center",
            padding: "32px 0",
            backgroundColor: "#F9FAFB",
            borderRadius: 14,
          }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>로그인 후 확인할 수 있습니다</p>
          </div>
        ) : reviews.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 14, padding: "32px 0" }}>
            아직 작성된 후기가 없습니다.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map((review) => (
              <div key={review.id} style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", backgroundColor: "#E5E7EB",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {review.user.avatar ? (
                      <img src={review.user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{review.user.nickname}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {renderStars(review.rating, 12)}
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{review.content}</p>
              </div>
            ))}
          </div>
        )}

        {isLoggedIn && hasCompleted && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="press"
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px 0",
              backgroundColor: "#fff",
              border: "1px solid #3787FF",
              borderRadius: 14,
              color: "#3787FF",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            후기 작성
          </button>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998,
          padding: 16,
        }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            style={{
              backgroundColor: "#fff", borderRadius: 20, padding: 24,
              width: "100%", maxWidth: 360,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 20, textAlign: "center" }}>
              후기 작성
            </h3>

            {/* Star Rating Selector */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={star <= reviewRating ? "#FBBF24" : "#E5E7EB"} stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Text Input */}
            <textarea
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              placeholder="후기를 작성해주세요..."
              style={{
                width: "100%",
                minHeight: 100,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                fontSize: 14,
                color: "#111",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setShowReviewModal(false)}
                className="press"
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12,
                  backgroundColor: "#F3F4F6", border: "none",
                  fontSize: 14, fontWeight: 600, color: "#6B7280", cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting || !reviewContent.trim()}
                className="press"
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12,
                  backgroundColor: reviewContent.trim() ? "#3787FF" : "#93C5FD",
                  border: "none",
                  fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer",
                  opacity: reviewSubmitting ? 0.6 : 1,
                }}
              >
                {reviewSubmitting ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div style={{ position: "sticky", bottom: 0, backgroundColor: "#fff", borderTop: "1px solid #F3F4F6", padding: "12px 16px", display: "flex", gap: 10 }}>
        <button
          onClick={handleBookmarkToggle}
          className="press"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            border: bookmarked ? "none" : "1px solid #E5E7EB",
            backgroundColor: bookmarked ? "#3787FF" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 30 30" fill={bookmarked ? "#fff" : "none"} stroke={bookmarked ? "#fff" : "#9CA3AF"} strokeWidth="1.5">
            <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z"/>
          </svg>
        </button>
        <button
          onClick={() => router.push(`/workbook/${id}/solve`)}
          className="press"
          style={{
            flex: 1,
            height: 48,
            backgroundColor: "#3787FF",
            color: "#fff",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            border: "none",
          }}
        >
          풀어보기
        </button>
      </div>
    </div>
  );
}
