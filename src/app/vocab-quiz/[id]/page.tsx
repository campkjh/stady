"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import AlertModal from "@/components/AlertModal";

interface VocabQuestion {
  id: string;
  order: number;
  word: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  answer: number;
  explanation?: string;
}

interface VocabQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  questions: VocabQuestion[];
}

export default function VocabQuizSolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quiz, setQuiz] = useState<VocabQuizSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, { selected: number; isCorrect: boolean }>
  >(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const [bookmarkToast, setBookmarkToast] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showSwipeGuide, setShowSwipeGuide] = useState(true);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [showResult, setShowResult] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Touch swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleBookmark = useCallback(async () => {
    if (!quiz) return;
    const currentQuestion = quiz.questions[currentIndex];
    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizType: "vocab",
          vocabQuizSetId: quiz.id,
          vocabQuestionId: currentQuestion.id,
        }),
      });
      setBookmarkToast(true);
      setTimeout(() => setBookmarkToast(false), 2000);
    } catch {}
  }, [quiz, currentIndex]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    fetch(`/api/vocab-quiz/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setQuiz(data.vocabQuizSet);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

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
      await fetch(`/api/vocab-quiz/${id}/submit`, {
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

  const currentQuestion = quiz?.questions[currentIndex] ?? null;

  useEffect(() => {
    if (showSwipeGuide) {
      const timer = setTimeout(() => setShowSwipeGuide(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showSwipeGuide]);

  useEffect(() => {
    if (showList && listScrollRef.current) {
      const activeEl = listScrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [showList, currentIndex]);

  const handleAnswer = (choiceNum: number) => {
    if (!currentQuestion || answers.has(currentQuestion.id)) return;

    const isCorrect = choiceNum === currentQuestion.answer;
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, { selected: choiceNum, isCorrect });
    setAnswers(newAnswers);

    // Check if all questions answered
    if (quiz && newAnswers.size === quiz.questions.length) {
      setTimeout(() => {
        submitQuiz();
        setShowResult(true);
      }, 1000);
    }
  };

  const goNext = () => {
    if (quiz && currentIndex < quiz.questions.length - 1) {
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
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 100) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const getChoices = (q: VocabQuestion) => [
    { num: 1, text: q.choice1 },
    { num: 2, text: q.choice2 },
    { num: 3, text: q.choice3 },
    { num: 4, text: q.choice4 },
  ];

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
    <div
      className="flex flex-col bg-white"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 500, margin: "0 auto" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        // 답변 후 아무 곳 클릭하면 다음 문제로
        if (answered && quiz) {
          const nextIdx = currentIndex + 1;
          if (nextIdx < quiz.questions.length) {
            setCurrentIndex(nextIdx);
          }
        }
      }}
    >
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
        <span className="text-sm text-gray-400" style={{ marginRight: 8 }}>
          {answers.size}/{quiz.questions.length}
        </span>
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
            <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>문제 목록</h3>
              <button type="button" onClick={() => setShowList(false)} style={{ background: "none", border: "none" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div ref={listScrollRef} style={{ padding: 8 }}>
              {quiz.questions.map((q, idx) => {
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
                      padding: "14px 12px",
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
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      backgroundColor: status === "correct" ? "#4A90D9" : status === "wrong" ? "#E85D5D" : "#D1D5DB",
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 14, color: "#111", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.word}
                    </span>
                    {status === "correct" && <img src="/icons/quiz-o.svg" alt="O" style={{ width: 20, height: 20 }} />}
                    {status === "wrong" && <img src="/icons/quiz-x.svg" alt="X" style={{ width: 20, height: 20 }} />}
                  </button>
                );
              })}
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

      {/* Progress bar */}
      <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / quiz.questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question area */}
      <div className="flex flex-1 flex-col px-4 py-6 overflow-y-auto" style={{ minHeight: 0 }}>
        {currentQuestion ? (
          <>
            {/* Question counter + nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                disabled={currentIndex === 0}
                className="press"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: "50%",
                  border: "1px solid #E5E7EB", background: "#fff",
                  opacity: currentIndex === 0 ? 0.3 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <p className="text-sm text-gray-400">
                {currentIndex + 1} / {quiz.questions.length}
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                disabled={currentIndex >= quiz.questions.length - 1}
                className="press"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: "50%",
                  border: "1px solid #E5E7EB", background: "#fff",
                  opacity: currentIndex >= quiz.questions.length - 1 ? 0.3 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Question text */}
            <div className="mb-4">
              <h2 className="text-xl font-bold leading-relaxed">
                &ldquo;{currentQuestion.word}&rdquo;의 뜻으로 알맞은 것은?
              </h2>
            </div>

            {/* Left/right tap zones for prev/next */}
            <div style={{ display: "flex", minHeight: 56, marginBottom: 16 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                disabled={currentIndex === 0}
                aria-label="이전 문제"
                style={{
                  flex: 1, background: "none", border: "none",
                  cursor: currentIndex === 0 ? "default" : "pointer",
                }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                disabled={currentIndex >= quiz.questions.length - 1}
                aria-label="다음 문제"
                style={{
                  flex: 1, background: "none", border: "none",
                  cursor: currentIndex >= quiz.questions.length - 1 ? "default" : "pointer",
                }}
              />
            </div>

            {/* Choice buttons */}
            <div className="flex flex-col gap-3">
              {getChoices(currentQuestion).map((choice) => {
                const isSelected = answered?.selected === choice.num;
                const isCorrectChoice =
                  answered && choice.num === currentQuestion.answer;

                let style =
                  "border-gray-200 bg-white text-gray-800 active:scale-[0.98]";
                if (answered) {
                  if (isCorrectChoice) {
                    style =
                      "border-[#3787FF] bg-[#E8F0FE] text-[#3787FF] ring-2 ring-[#3787FF]/30";
                  } else if (isSelected && !answered.isCorrect) {
                    style =
                      "border-red-400 bg-[#FFE0E0] text-red-700 ring-2 ring-red-300";
                  } else {
                    style = "border-gray-200 bg-gray-50 text-gray-400";
                  }
                }

                return (
                  <button
                    key={choice.num}
                    onClick={() => handleAnswer(choice.num)}
                    disabled={!!answered}
                    className={`rounded-full border-2 px-6 py-4 text-left text-base font-medium transition ${style}`}
                  >
                    <span className="mr-2 inline-block w-6 text-center font-bold">
                      {choice.num}
                    </span>
                    {choice.text}
                  </button>
                );
              })}
            </div>

            {/* Result indicator */}
            {answered && (
              <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "resultFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)", position: "relative", zIndex: 10 }}>
                <img
                  src={answered.isCorrect ? "/icons/quiz-o.svg" : "/icons/quiz-x.svg"}
                  alt={answered.isCorrect ? "O" : "X"}
                  style={{ width: 64, height: 64 }}
                />
                <p style={{ fontSize: 16, fontWeight: 700, color: answered.isCorrect ? "#3787FF" : "#E85D5D" }}>
                  {answered.isCorrect ? "정답" : "아니다"}
                </p>
                {currentQuestion.explanation && (
                  <div style={{ width: "100%", padding: "14px 16px", borderRadius: 12, backgroundColor: "#F9FAFB", marginTop: 4 }}>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{currentQuestion.explanation}</p>
                  </div>
                )}
                {!answered.isCorrect && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!quiz) return;
                      try {
                        await fetch("/api/bookmarks", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ quizType: "vocab", vocabQuizSetId: quiz.id, vocabQuestionId: currentQuestion.id }),
                        });
                        setBookmarkToast(true);
                        setTimeout(() => setBookmarkToast(false), 2000);
                      } catch {}
                    }}
                    className="press"
                    style={{
                      width: "100%",
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "#F2F3F5",
                      border: "none",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#51535C",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 30 30" fill="#51535C">
                      <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z"/>
                    </svg>
                    책갈피에 추가하기
                  </button>
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
            <p className="text-gray-400">문제가 없습니다.</p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", flexShrink: 0, borderTop: "1px solid #F3F4F6" }}>
        <button
          type="button"
          onClick={handleBookmark}
          className="press"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          <svg width="24" height="24" viewBox="0 0 30 30" fill="none">
            <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z" fill="#9CA3AF"/>
          </svg>
        </button>
        <div className="text-center text-xs text-gray-300">
          ← 좌우로 스와이프하여 이동 →
        </div>
        <div style={{ width: 24 }} />
      </div>

      {/* Swipe Guide */}
      {showSwipeGuide && (
        <div
          onClick={() => setShowSwipeGuide(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
            animation: "fadeIn 0.4s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24, animation: "swipeHint 1.5s ease-in-out infinite" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8c0 4 3 7 7 7h1a5 5 0 0 0 5-5v-4a2 2 0 0 0-4 0v3"/></svg>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
          <p style={{ color: "#fff", fontSize: 16, fontWeight: 600, textAlign: "center", lineHeight: 1.6 }}>좌우로 스와이프하면<br/>이전·다음 문제를 확인할 수 있어요</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 8 }}>화면을 탭하면 닫힙니다</p>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes swipeHint { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-12px); } 60% { transform: translateX(12px); } }
      `}</style>

      {/* Exit Confirm */}
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

      {/* Result Modal */}
      {showResult && quiz && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div style={{
            position: "relative",
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: "32px 24px",
            width: "85%",
            maxWidth: 340,
            textAlign: "center",
            animation: "fadeInUp 0.3s ease",
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
              다 풀으셨나요?
            </h2>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 24 }}>
              {Array.from(answers.values()).filter(a => a.isCorrect).length}/{quiz.questions.length} 정답
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setAnswers(new Map());
                  setCurrentIndex(0);
                  setSubmitted(false);
                  setShowResult(false);
                }}
                className="press"
                style={{
                  padding: "14px 0",
                  borderRadius: 14,
                  backgroundColor: "#4A90D9",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  border: "none",
                  width: "100%",
                }}
              >
                다시풀기
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="press"
                style={{
                  padding: "14px 0",
                  borderRadius: 14,
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  fontSize: 16,
                  fontWeight: 600,
                  border: "none",
                  width: "100%",
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Toast */}
      {bookmarkToast && (
        <div style={{
          position: "fixed",
          bottom: 100,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 100,
          animation: "fadeInUp 0.3s ease",
        }}>
          책갈피에 추가되었습니다
        </div>
      )}
    </div>
  );
}
