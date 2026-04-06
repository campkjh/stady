"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import AlertModal from "@/components/AlertModal";

interface OxQuestion {
  id: string;
  order: number;
  question: string;
  answer: boolean;
  explanation?: string;
}

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  questions: OxQuestion[];
}

type TabFilter = "all" | "correct" | "wrong";

export default function OxQuizSolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quiz, setQuiz] = useState<OxQuizSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, { selected: boolean; isCorrect: boolean }>
  >(new Map());
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [submitted, setSubmitted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showSwipeGuide, setShowSwipeGuide] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState(false);
  const [startTime] = useState(Date.now());
  const listScrollRef = useRef<HTMLDivElement>(null);

  // Touch swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    fetch(`/api/ox-quiz/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setQuiz(data.oxQuizSet);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const filteredQuestions = quiz
    ? quiz.questions.filter((q) => {
        if (tabFilter === "all") return true;
        const ans = answers.get(q.id);
        if (!ans) return false;
        if (tabFilter === "correct") return ans.isCorrect;
        return !ans.isCorrect;
      })
    : [];

  const currentQuestion = filteredQuestions[currentIndex] ?? null;

  // Auto-dismiss swipe guide
  useEffect(() => {
    if (showSwipeGuide) {
      const timer = setTimeout(() => setShowSwipeGuide(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showSwipeGuide]);

  // Auto-scroll drawer to current question
  useEffect(() => {
    if (showList && listScrollRef.current) {
      const activeEl = listScrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [showList, currentIndex]);

  const submitQuiz = useCallback(async () => {
    if (submitted || !quiz) return;
    setSubmitted(true);

    const answerArray = quiz.questions.map((q) => {
      const ans = answers.get(q.id);
      return {
        questionId: q.id,
        selected: ans?.selected ?? null,
      };
    });

    try {
      await fetch(`/api/ox-quiz/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answerArray,
          timeTaken: Math.floor((Date.now() - startTime) / 1000),
        }),
      });
    } catch {
      // allow viewing results even if submit fails
    }
  }, [submitted, quiz, answers, id, startTime]);

  const handleAnswer = (selected: boolean) => {
    if (!currentQuestion || answers.has(currentQuestion.id) || navigating) return;

    const isCorrect = selected === currentQuestion.answer;
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, { selected, isCorrect });
    setAnswers(newAnswers);

    // Check if all questions answered
    if (quiz && newAnswers.size === quiz.questions.length) {
      // Small delay so user sees the result before submit
      setTimeout(() => submitQuiz(), 800);
    }
  };

  const goNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // 초기화
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    // 확실한 스와이프만 감지 (100px 이상 이동해야 동작)
    if (Math.abs(diff) > 100) {
      if (diff > 0) goNext();
      else goPrev();
    }
    // 초기화
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [tabFilter]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-500">퀴즈를 찾을 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const answered = currentQuestion ? answers.get(currentQuestion.id) : null;

  return (
    <div className="flex flex-col bg-white" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 500, margin: "0 auto" }}>
      {/* Header */}
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => answers.size > 0 ? setShowExitConfirm(true) : router.back()}
          className="press"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="flex-1 truncate text-lg font-bold">{quiz.title}</h1>
        <button
          type="button"
          onClick={() => setShowList(true)}
          className="press"
          style={{ background: "none", border: "none" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Tab filter */}
      <div style={{ display: "flex", gap: 12, padding: "8px 16px", justifyContent: "center" }}>
        {[
          { key: "all" as TabFilter, icon: "/icons/emoji-solved.svg", label: "풀은문제", count: answers.size },
          { key: "correct" as TabFilter, icon: "/icons/emoji-correct.svg", label: "맞춘문제", count: Array.from(answers.values()).filter(a => a.isCorrect).length },
          { key: "wrong" as TabFilter, icon: "/icons/emoji-wrong.svg", label: "틀린문제", count: Array.from(answers.values()).filter(a => !a.isCorrect).length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className="press"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              opacity: tabFilter === tab.key ? 1 : 0.4,
              transition: "opacity 0.2s ease",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              <img src={tab.icon} alt="" style={{ width: 32, height: 32 }} />
              {tab.count > 0 && (
                <span style={{
                  position: "absolute",
                  top: -4,
                  right: -8,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: "#E85D5D",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {tab.count}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Question area */}
      <div
        className="flex flex-1 flex-col px-4 py-6 overflow-y-auto"
        style={{ minHeight: 0 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentQuestion ? (
          <>
            {/* Question counter + bookmark */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: "#9CA3AF" }}>
                {currentIndex + 1} / {filteredQuestions.length}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!currentQuestion || !quiz) return;
                  try {
                    await fetch("/api/bookmarks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ quizType: "ox", oxQuizSetId: quiz.id, oxQuestionId: currentQuestion.id }),
                    });
                    setBookmarkToast(true);
                    setTimeout(() => setBookmarkToast(false), 2000);
                  } catch {}
                }}
                className="press"
                style={{ background: "none", border: "none", padding: 2 }}
              >
                <svg width="16" height="16" viewBox="0 0 30 30" fill="none">
                  <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z" fill="#B0B8C1"/>
                </svg>
              </button>
            </div>

            {/* Question text */}
            <div className="mb-8 flex-1">
              <h2 className="text-xl font-bold leading-relaxed">
                Q. {currentQuestion.question}?
              </h2>
            </div>

            {/* Answer buttons */}
            <div style={{ display: "flex", gap: 16, flexShrink: 0, width: "100%" }}>
              <button
                onClick={() => handleAnswer(true)}
                disabled={!!answered}
                style={{
                  flex: 1,
                  aspectRatio: "1/1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 20,
                  border: "none",
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  backgroundColor: answered
                    ? answered.selected === true
                      ? answered.isCorrect ? "#E8F0FE" : "#FFE0E0"
                      : "#F9FAFB"
                    : "#E8F0FE",
                  opacity: answered && answered.selected !== true ? 0.5 : 1,
                  boxShadow: answered && answered.selected === true
                    ? answered.isCorrect ? "inset 0 0 0 2px #3787FF" : "inset 0 0 0 2px #E85D5D"
                    : "none",
                }}
              >
                <img src="/icons/quiz-o.svg" alt="O" style={{ width: 64, height: 64 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>그렇다</span>
              </button>

              <button
                onClick={() => handleAnswer(false)}
                disabled={!!answered}
                style={{
                  flex: 1,
                  aspectRatio: "1/1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 20,
                  border: "none",
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  backgroundColor: answered
                    ? answered.selected === false
                      ? answered.isCorrect ? "#E8F0FE" : "#FFE0E0"
                      : "#F9FAFB"
                    : "#FFE0E0",
                  opacity: answered && answered.selected !== false ? 0.5 : 1,
                  boxShadow: answered && answered.selected === false
                    ? answered.isCorrect ? "inset 0 0 0 2px #3787FF" : "inset 0 0 0 2px #E85D5D"
                    : "none",
                }}
              >
                <img src="/icons/quiz-x.svg" alt="X" style={{ width: 64, height: 64 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>아니다</span>
              </button>
            </div>

            {/* Result + Explanation + Next */}
            {answered && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                marginTop: 24,
                animation: "resultFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              }}>
                <img
                  src={answered.isCorrect ? "/icons/quiz-o.svg" : "/icons/quiz-x.svg"}
                  alt={answered.isCorrect ? "O" : "X"}
                  style={{ width: 64, height: 64 }}
                />
                <p style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: answered.isCorrect ? "#3787FF" : "#E85D5D",
                }}>
                  {answered.isCorrect ? "정답" : "오답"}
                </p>
                {currentQuestion.explanation && (
                  <div style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 12,
                    backgroundColor: "#F9FAFB",
                    marginTop: 4,
                  }}>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            <style>{`
              @keyframes resultFadeUp {
                from { opacity: 0; transform: translateY(20px) scale(0.9); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-400">
              {tabFilter === "all"
                ? "문제가 없습니다."
                : tabFilter === "correct"
                  ? "맞춘 문제가 없습니다."
                  : "틀린 문제가 없습니다."}
            </p>
          </div>
        )}
      </div>

      {/* Question List Drawer */}
      {showList && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={() => setShowList(false)}
          />
          <div style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "80%",
            maxWidth: 320,
            backgroundColor: "#fff",
            overflowY: "auto",
            animation: "slideInRight 0.25s ease",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
          }}>
            {/* Drawer Header */}
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>문제 목록</h3>
                <button type="button" onClick={() => setShowList(false)} style={{ background: "none", border: "none" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setShowList(false); router.push("/ox-quiz-intro"); }}
                className="press"
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: "#F0F5FF",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3787FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3787FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                다른 문제 풀러가기
              </button>
            </div>
            <div ref={listScrollRef} style={{ padding: 8 }}>
              {filteredQuestions.map((q) => {
                const idx = quiz.questions.findIndex((qq) => qq.id === q.id);
                const ans = answers.get(q.id);
                const status = ans ? (ans.isCorrect ? "correct" : "wrong") : "unanswered";
                return (
                  <button
                    key={q.id}
                    type="button"
                    data-active={currentIndex === idx}
                    onClick={() => { setCurrentIndex(idx); setShowList(false); }}
                    className="press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "12px",
                      background: currentIndex === idx ? "#F0F5FF" : "none",
                      border: "none",
                      borderRadius: 10,
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      backgroundColor: status === "correct" ? "#3787FF" : status === "wrong" ? "#E85D5D" : "#D1D5DB",
                      flexShrink: 0,
                    }}>
                      {q.order}
                    </span>
                    <span style={{ fontSize: 13, color: "#111", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.question}
                    </span>
                    {ans && (
                      <span style={{ fontSize: 12, color: ans.selected ? "#3787FF" : "#E85D5D", fontWeight: 600, flexShrink: 0 }}>
                        {ans.selected ? "O" : "X"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid #F3F4F6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              color: "#9CA3AF",
            }}>
              <span>풀은 문제 {answers.size}/{quiz.questions.length}</span>
              <span style={{ color: "#3787FF", fontWeight: 600 }}>
                정답률 {answers.size > 0 ? Math.round(Array.from(answers.values()).filter(a => a.isCorrect).length / answers.size * 100) : 0}%
              </span>
            </div>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Swipe Guide Overlay */}
      {showSwipeGuide && (
        <div
          onClick={() => setShowSwipeGuide(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            animation: "fadeIn 0.4s ease",
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            animation: "swipeHint 1.5s ease-in-out infinite",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-4 0v5" />
              <path d="M14 10V4a2 2 0 0 0-4 0v6" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8c0 4 3 7 7 7h1a5 5 0 0 0 5-5v-4a2 2 0 0 0-4 0v3" />
            </svg>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <p style={{ color: "#fff", fontSize: 16, fontWeight: 600, textAlign: "center", lineHeight: 1.6 }}>
            좌우로 스와이프하면<br/>이전·다음 문제를 확인할 수 있어요
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 8 }}>
            화면을 탭하면 닫힙니다
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes swipeHint {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(-12px); }
          60% { transform: translateX(12px); }
        }
      `}</style>

      {/* Exit Confirm */}
      {bookmarkToast && (
        <div style={{
          position: "fixed",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          책갈피에 추가되었습니다
        </div>
      )}
      <style>{`
        @keyframes toastIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>

      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowExitConfirm(false)} />
          <div style={{ position: "relative", width: "calc(100% - 32px)", maxWidth: 375, backgroundColor: "#fff", borderRadius: 20, padding: 12, animation: "slideUpAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 4px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D" }}>정말로 나가시겠습니까?</h2>
              <p style={{ fontSize: 15, color: "#8A909C", marginTop: 1 }}>풀고 있던 문제가 저장되지 않습니다.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => router.back()} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F2F3F5", color: "#51535C", fontSize: 18, fontWeight: 700, border: "none" }}>나가기</button>
              <button type="button" onClick={() => setShowExitConfirm(false)} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#3787FF", color: "#fff", fontSize: 18, fontWeight: 700, border: "none" }}>계속 풀기</button>
            </div>
          </div>
          <style>{`@keyframes slideUpAlert { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}
