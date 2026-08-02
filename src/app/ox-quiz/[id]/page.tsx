"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import SideTapNavigation from "@/components/SideTapNavigation";
import AlertModal from "@/components/AlertModal";
import QuizMemoPad, { type MemoPadHandle } from "@/components/QuizMemoPad";
import QuizTimer from "@/components/QuizTimer";
import LoginRequired from "@/components/LoginRequired";
import { maybePromptAppReviewAfterQuiz } from "@/lib/appReview";

interface OxQuestion {
  id: string;
  order: number;
  section?: string | null;
  question: string;
  answer: boolean;
  explanation?: string;
  examYearMonth?: string | null;
  answerRate?: number | null;
}

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  category?: { id: string; name: string } | null;
  questions: OxQuestion[];
}

interface BookmarkItem {
  quizType: string;
  oxQuizSetId: string | null;
  oxQuestionId: string | null;
  memo?: string | null;
  drawing?: string | null;
}

type TabFilter = "all" | "correct" | "wrong";

// 정답률이 이 값 미만이면 "핵어려움"으로 표시(절대 기준).
const HARD_ANSWER_RATE = 60;

export default function OxQuizSolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quiz, setQuiz] = useState<OxQuizSet | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, { selected: boolean; isCorrect: boolean }>
  >(new Map());
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; scorePct: number; topPercent: number | null } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showSwipeGuide, setShowSwipeGuide] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 토스트를 띄울 때 이전 타이머를 정리해, 오래된 타이머가 새 토스트를 지우지 않게 한다.
  const showToast = useCallback((message: string, ms = 2000) => {
    setBookmarkToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setBookmarkToast(""), ms);
  }, []);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [bookmarkMode, setBookmarkMode] = useState({ enabled: false, focusId: null as string | null });
  const [startTime, setStartTime] = useState(() => Date.now());
  // 순서 섞기(회독용): 켜면 문제 순서를 랜덤으로. 순서를 localStorage에 저장해
  // 이어풀기의 currentIndex가 어긋나지 않게 한다. 북마크 모드에선 미사용.
  const [shuffleOn, setShuffleOn] = useState(false);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState(false);
  const originalQuestionsRef = useRef<OxQuestion[] | null>(null);
  // 퀴즈 노트(나만 보는 메모, 저장 시 해당 문제가 책갈피에 추가됨). 끄면 버튼 숨김.
  const [noteEnabled, setNoteEnabled] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showNoteLossConfirm, setShowNoteLossConfirm] = useState(false);
  const [drawingByQuestion, setDrawingByQuestion] = useState<Map<string, string>>(new Map());
  const memoPadRef = useRef<MemoPadHandle>(null);
  const [memoByQuestion, setMemoByQuestion] = useState<Map<string, string>>(new Map());
  const [progressReady, setProgressReady] = useState(false);
  const [pendingProgress, setPendingProgress] = useState<{
    answersJson: string;
    currentIndex: number;
  } | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const progressKey = bookmarkMode.enabled ? null : `ox:${id}`;

  // Touch swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (isLoggedIn !== true) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isLoggedIn]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBookmarkMode({
      enabled: params.get("bookmark") === "1",
      focusId: params.get("id"),
    });
  }, []);

  useEffect(() => {
    if (isLoggedIn !== true) return;
    setLoading(true);
    fetch(`/api/ox-quiz/${id}`)
      .then((res) => res.json())
      .then(async (data) => {
        let nextQuiz = data.oxQuizSet as OxQuizSet;
        let bookmarkedIds = new Set<string>();

        const memoMap = new Map<string, string>();
        const drawMap = new Map<string, string>();
        try {
          const bmRes = await fetch("/api/bookmarks?quizType=ox");
          if (bmRes.ok) {
            const bmData = await bmRes.json();
            const mine = ((bmData.bookmarks || []) as BookmarkItem[]).filter(
              (bm) => bm.oxQuizSetId === id && bm.oxQuestionId
            );
            bookmarkedIds = new Set(mine.map((bm) => bm.oxQuestionId as string));
            for (const bm of mine) {
              if (bm.memo) memoMap.set(bm.oxQuestionId as string, bm.memo);
              if (bm.drawing) drawMap.set(bm.oxQuestionId as string, bm.drawing);
            }
          }
        } catch {}
        setBookmarkedQuestionIds(bookmarkedIds);
        setMemoByQuestion(memoMap);
        setDrawingByQuestion(drawMap);

        if (bookmarkMode.enabled) {
          nextQuiz = {
            ...nextQuiz,
            title: `${nextQuiz.title} 책갈피`,
            totalQuestions: bookmarkedIds.size,
            questions: nextQuiz.questions.filter((question) => bookmarkedIds.has(question.id)),
          };
        } else {
          // 저장된 셔플 순서가 있으면 복원(이어풀기의 currentIndex 정합 유지).
          originalQuestionsRef.current = nextQuiz.questions;
          try {
            const raw = localStorage.getItem(`ox_shuffle_${id}`);
            const order = raw ? (JSON.parse(raw) as string[]) : null;
            if (Array.isArray(order) && order.length > 0) {
              const byId = new Map(nextQuiz.questions.map((q) => [q.id, q]));
              const reordered = order.map((qid) => byId.get(qid)).filter(Boolean) as OxQuestion[];
              // 세트 재임포트로 id가 전부 바뀌었으면(매칭 0) 셔플을 무효로 본다.
              if (reordered.length > 0) {
                // 순서에 없는 새 문항은 뒤에 원래 순서로 붙인다(세트 수정 대비).
                const inOrder = new Set(order);
                for (const q of nextQuiz.questions) if (!inOrder.has(q.id)) reordered.push(q);
                nextQuiz = { ...nextQuiz, questions: reordered };
                setShuffleOn(true);
              } else {
                localStorage.removeItem(`ox_shuffle_${id}`);
              }
            }
          } catch {}
        }

        setQuiz(nextQuiz);
        if (bookmarkMode.focusId) {
          const focusIndex = nextQuiz.questions.findIndex((question) => question.id === bookmarkMode.focusId);
          if (focusIndex >= 0) setCurrentIndex(focusIndex);
        } else {
          setCurrentIndex(0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, bookmarkMode, isLoggedIn]);

  // Load saved progress once quiz is ready
  useEffect(() => {
    if (!quiz || progressReady || !progressKey) {
      if (!progressKey && quiz && !progressReady) setProgressReady(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/quiz-progress?quizKey=${encodeURIComponent(progressKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const row = data?.progress;
        if (row?.answersJson) {
          try {
            const entries = JSON.parse(row.answersJson) as [string, { selected: boolean; isCorrect: boolean }][];
            if (Array.isArray(entries) && entries.length > 0) {
              setPendingProgress({ answersJson: row.answersJson, currentIndex: row.currentIndex || 0 });
              return;
            }
          } catch {}
        }
        setProgressReady(true);
      })
      .catch(() => setProgressReady(true));
    return () => {
      cancelled = true;
    };
  }, [quiz, progressReady, progressKey]);

  // Persist progress on changes
  useEffect(() => {
    if (!progressReady || !progressKey || answers.size === 0 || submitted) return;
    const payload = {
      quizKey: progressKey,
      answersJson: JSON.stringify(Array.from(answers.entries())),
      currentIndex,
    };
    const t = setTimeout(() => {
      fetch("/api/quiz-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [answers, currentIndex, progressReady, progressKey, submitted]);

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

    // 로컬 채점(제출 실패해도 결과는 보여준다).
    const correct = Array.from(answers.values()).filter((a) => a.isCorrect).length;
    const total = quiz.questions.length;
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    let topPercent: number | null = null;
    try {
      const res = await fetch(`/api/ox-quiz/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answerArray,
          timeTaken: Math.floor((Date.now() - startTime) / 1000),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.topPercent === "number") topPercent = data.topPercent;
    } catch {
      // allow viewing results even if submit fails
    }
    setResult({ correct, total, scorePct, topPercent });
    if (progressKey) {
      // 회독 완료 → 셔플 순서도 함께 버린다(다음에 다시 섞으면 새 순서).
      // 북마크 모드(progressKey null)에선 본 세트의 순서를 건드리면 안 된다.
      try { localStorage.removeItem(`ox_shuffle_${id}`); } catch {}
      fetch(`/api/quiz-progress?quizKey=${encodeURIComponent(progressKey)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }, [submitted, quiz, answers, id, startTime, progressKey]);

  // 노트 기능 on/off 설정 복원(기기별).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteEnabled(localStorage.getItem("quiz_note_off") !== "1");
    } catch {}
  }, []);

  // 순서 섞기 적용/해제: 진행 중 답이 있으면 확인 모달을 거쳐 처음부터 다시 시작한다.
  const applyShuffleToggle = useCallback(() => {
    const original = originalQuestionsRef.current;
    if (!quiz || !original) return;
    setShowShuffleConfirm(false);
    if (shuffleOn) {
      // 원래 순서로 복원
      try { localStorage.removeItem(`ox_shuffle_${id}`); } catch {}
      setQuiz({ ...quiz, questions: original });
      setShuffleOn(false);
    } else {
      // Fisher-Yates 셔플
      const arr = [...original];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      try { localStorage.setItem(`ox_shuffle_${id}`, JSON.stringify(arr.map((q) => q.id))); } catch {}
      setQuiz({ ...quiz, questions: arr });
      setShuffleOn(true);
    }
    setAnswers(new Map());
    setCurrentIndex(0);
    setTabFilter("all");
    // 새 회독 시작: 완료 상태/결과/이어풀기 프롬프트를 모두 리셋해야
    // 다시 푼 뒤 제출이 막히거나(submitted 잔존) 삭제한 진행이 부활하지 않는다.
    setSubmitted(false);
    setResult(null);
    setPendingProgress(null);
    setProgressReady(true);
    setStartTime(Date.now());
    if (progressKey) {
      fetch(`/api/quiz-progress?quizKey=${encodeURIComponent(progressKey)}`, { method: "DELETE" }).catch(() => {});
    }
  }, [quiz, shuffleOn, id, progressKey]);

  // 책갈피 토글(서버는 memo 없이 오면 토글 → 해제 시 노트가 담긴 row 자체가 삭제됨).
  const toggleBookmark = useCallback(async () => {
    if (!currentQuestion || !quiz) return;
    setShowNoteLossConfirm(false);
    const hadNote = memoByQuestion.has(currentQuestion.id) || drawingByQuestion.has(currentQuestion.id);
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizType: "ox", oxQuizSetId: quiz.id, oxQuestionId: currentQuestion.id }),
      });
      if (!response.ok) throw new Error("Failed to toggle bookmark");
      const data = await response.json();
      setBookmarkedQuestionIds((prev) => {
        const next = new Set(prev);
        if (data.bookmarked) next.add(currentQuestion.id);
        else next.delete(currentQuestion.id);
        return next;
      });
      if (!data.bookmarked && hadNote) {
        setMemoByQuestion((prev) => {
          const next = new Map(prev);
          next.delete(currentQuestion.id);
          return next;
        });
        setDrawingByQuestion((prev) => {
          const next = new Map(prev);
          next.delete(currentQuestion.id);
          return next;
        });
      }
      showToast(
        data.bookmarked
          ? "책갈피에 추가되었습니다"
          : hadNote ? "책갈피가 취소되었습니다 · 노트도 삭제됐어요" : "책갈피가 취소되었습니다"
      );
    } catch {
      showToast("책갈피 처리에 실패했어요");
    }
  }, [currentQuestion, quiz, memoByQuestion, drawingByQuestion, showToast]);

  // 퀴즈 노트 저장: 저장하면 해당 문제가 책갈피에 추가되고(업서트) 메모는 나만 본다.
  const saveNote = useCallback(async () => {
    if (!currentQuestion || !quiz || noteSaving) return;
    const hadNote = memoByQuestion.has(currentQuestion.id) || drawingByQuestion.has(currentQuestion.id);
    const drawing = memoPadRef.current?.exportDrawing() ?? null;
    // 글도 그림도 없이 저장하면 의미 없는 책갈피만 생기므로 그냥 닫는다.
    if (!noteText.trim() && !drawing && !hadNote) {
      setNoteOpen(false);
      return;
    }
    setNoteSaving(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizType: "ox",
          oxQuizSetId: quiz.id,
          oxQuestionId: currentQuestion.id,
          memo: noteText.trim(),
          drawing: drawing ?? "",
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const trimmed = noteText.trim();
      setMemoByQuestion((prev) => {
        const next = new Map(prev);
        if (trimmed) next.set(currentQuestion.id, trimmed);
        else next.delete(currentQuestion.id);
        return next;
      });
      setDrawingByQuestion((prev) => {
        const next = new Map(prev);
        if (drawing) next.set(currentQuestion.id, drawing);
        else next.delete(currentQuestion.id);
        return next;
      });
      setBookmarkedQuestionIds((prev) => new Set(prev).add(currentQuestion.id));
      setNoteOpen(false);
      showToast(trimmed || drawing ? "노트가 저장됐어요 · 책갈피에서 볼 수 있어요" : "노트를 비웠어요", 2200);
    } catch {
      showToast("노트 저장에 실패했어요");
    } finally {
      setNoteSaving(false);
    }
  }, [currentQuestion, quiz, noteText, noteSaving, memoByQuestion, drawingByQuestion, showToast]);

  const handleAnswer = (selected: boolean) => {
    if (!currentQuestion || answers.has(currentQuestion.id) || navigating) return;

    const isCorrect = selected === currentQuestion.answer;
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, { selected, isCorrect });
    setAnswers(newAnswers);

    // 한 판에서 3번째 문제를 푼 순간, 계정당 1회 앱 리뷰 프롬프트를 띄운다.
    if (newAnswers.size === 3) {
      maybePromptAppReviewAfterQuiz();
    }

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

  if (isLoggedIn === false) return <LoginRequired />;

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
  const isBookmarked = currentQuestion ? bookmarkedQuestionIds.has(currentQuestion.id) : false;
  const breadcrumb = [
    quiz.category?.name,
    quiz.title,
    currentQuestion?.section,
  ].filter(Boolean).join(" > ");

  return (
    <div className="flex flex-col bg-white" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 720, margin: "0 auto", overflow: "hidden" }}>
      {/* Header — 제목/타이머, 진행도·도구, 필터를 한 덩어리로 통합 */}
      <header
        style={{
          position: "relative", zIndex: 20, flexShrink: 0,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid #EDF0F3",
          boxShadow: "0 1px 12px rgba(15,23,42,0.04)",
        }}
      >
        {/* 1행: 나가기 · 제목/소분류 · 타이머 · 목록 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px" }}>
          <button
            type="button"
            aria-label="나가기"
            onClick={() => answers.size > 0 ? setShowExitConfirm(true) : router.back()}
            className="press"
            style={{ ...hIconBtn, background: "none", border: "none" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B313D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 14.5, fontWeight: 800, color: "#191F28", letterSpacing: "-0.3px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {quiz.title}
            </p>
            <p style={{
              margin: "1px 0 0", fontSize: 11.5, fontWeight: 600, color: "#9CA3AF",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {[
                quiz.category?.name,
                currentQuestion?.section && currentQuestion.section.trim() !== quiz.title.trim()
                  ? currentQuestion.section
                  : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <QuizTimer startAt={startTime} paused={submitted} />
          <button
            type="button"
            aria-label="문제 목록"
            onClick={() => setShowList(true)}
            className="press"
            style={{ ...hIconBtn, background: "none", border: "none" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B313D" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>

        {/* 2행: 진행도(N/M) · 이전/다음 · 섞기/노트/책갈피 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px 8px" }}>
          <button type="button" aria-label="이전 문제" onClick={goPrev} disabled={currentIndex === 0} className="press"
            style={{ ...hRoundBtn, opacity: currentIndex === 0 ? 0.28 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#191F28", letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
            {currentIndex + 1}
            <span style={{ color: "#B0B8C1", fontWeight: 700 }}> / {filteredQuestions.length}</span>
          </span>
          <button type="button" aria-label="다음 문제" onClick={goNext} disabled={currentIndex >= filteredQuestions.length - 1} className="press"
            style={{ ...hRoundBtn, opacity: currentIndex >= filteredQuestions.length - 1 ? 0.28 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
            {!bookmarkMode.enabled && (
              <button
                type="button" aria-label="문제 순서 섞기"
                onClick={() => { if (answers.size > 0) setShowShuffleConfirm(true); else applyShuffleToggle(); }}
                className="press" style={hToolBtn(shuffleOn, "#3787FF", "#EEF5FF")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            )}
            {noteEnabled && (
              <button
                type="button" aria-label="퀴즈 노트"
                onClick={() => {
                  if (!currentQuestion) return;
                  setNoteText(memoByQuestion.get(currentQuestion.id) ?? "");
                  setNoteOpen(true);
                }}
                className="press"
                style={hToolBtn(
                  !!currentQuestion && (memoByQuestion.has(currentQuestion.id) || drawingByQuestion.has(currentQuestion.id)),
                  "#B26A00", "#FFF7E8"
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
            <button
              type="button" aria-label="책갈피"
              onClick={() => {
                if (!currentQuestion) return;
                if (isBookmarked && (memoByQuestion.has(currentQuestion.id) || drawingByQuestion.has(currentQuestion.id))) {
                  setShowNoteLossConfirm(true);
                  return;
                }
                toggleBookmark();
              }}
              className="press" style={hToolBtn(isBookmarked, "#3787FF", "#EEF5FF")}
            >
              <svg width="16" height="16" viewBox="0 0 30 30" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M7.33325 7.63221C7.33325 6.73104 8.00454 6 8.83325 6H20.8333C21.6614 6 22.3333 6.73046 22.3333 7.63221V22.9103C22.3333 23.7481 21.4997 24.2713 20.8333 23.8526L15.5835 20.5546C15.1193 20.2631 14.5478 20.2631 14.0835 20.5546L8.83379 23.8526C8.1673 24.2713 7.33379 23.7481 7.33379 22.9103L7.33325 7.63221Z" />
              </svg>
            </button>
          </span>
        </div>

        {/* 3행: 필터 칩 */}
        <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
          {[
            { key: "all" as TabFilter, label: "전체", count: answers.size, tint: "#2B313D", bg: "#EEF0F3" },
            { key: "correct" as TabFilter, label: "맞은 문제", count: Array.from(answers.values()).filter(a => a.isCorrect).length, tint: "#1F5EDC", bg: "#EAF2FF" },
            { key: "wrong" as TabFilter, label: "틀린 문제", count: Array.from(answers.values()).filter(a => !a.isCorrect).length, tint: "#D93A4E", bg: "#FFEFF1" },
          ].map((tab) => {
            const on = tabFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTabFilter(tab.key)}
                className="press"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 28, padding: "0 11px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${on ? "transparent" : "#EDF0F3"}`,
                  background: on ? tab.bg : "#fff",
                  color: on ? tab.tint : "#8B95A1",
                  fontSize: 12.5, fontWeight: 800, letterSpacing: "-0.2px",
                  transition: "background 0.16s ease, color 0.16s ease",
                }}
              >
                {tab.label}
                <span style={{ fontSize: 11.5, fontWeight: 800, opacity: on ? 0.85 : 0.7, fontVariantNumeric: "tabular-nums" }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 진행 게이지 */}
        <div style={{ height: 3, background: "#F1F3F5" }}>
          <div
            style={{
              height: "100%",
              width: `${quiz.questions.length > 0 ? Math.min(100, (answers.size / quiz.questions.length) * 100) : 0}%`,
              background: "linear-gradient(90deg, #7DC4FF, #3787FF)",
              borderTopRightRadius: 3, borderBottomRightRadius: 3,
              transition: "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
      </header>

      <SideTapNavigation
        onPrev={goPrev}
        onNext={goNext}
        prevDisabled={currentIndex === 0}
        nextDisabled={currentIndex >= filteredQuestions.length - 1}
      />

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
            {/* Question text + tap zones below */}
            <div className="mb-8 flex-1" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  {currentQuestion.section && currentQuestion.section.trim() !== quiz.title.trim() && (
                    <span style={{
                      display: "inline-flex",
                      fontSize: 12, fontWeight: 700, color: "#3787FF",
                      background: "#EBF3FF", borderRadius: 6, padding: "3px 10px",
                    }}>
                      {currentQuestion.section}
                    </span>
                  )}
                  {currentQuestion.examYearMonth && (
                    <span style={{
                      display: "inline-flex",
                      fontSize: 12, fontWeight: 700, color: "#374151",
                      background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, padding: "3px 10px",
                    }}>
                      {currentQuestion.examYearMonth}
                    </span>
                  )}
                  {/* 정답률·핵어려움은 정답 힌트가 되므로 문제를 푼 직후에만 공개 */}
                  {!!answered && currentQuestion.answerRate != null && (
                    <span style={{
                      display: "inline-flex",
                      fontSize: 12, fontWeight: 700, color: "#374151",
                      background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, padding: "3px 10px",
                    }}>
                      정답률 {currentQuestion.answerRate}%
                    </span>
                  )}
                  {!!answered && currentQuestion.answerRate != null && currentQuestion.answerRate < HARD_ANSWER_RATE && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, fontWeight: 800, color: "#F93052",
                      background: "#FEF2F2", borderRadius: 6, padding: "3px 10px",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/fire-hard.svg" alt="" style={{ width: 14, height: 14 }} />
                      핵어려움
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold leading-relaxed">
                  Q. {currentQuestion.question}
                </h2>
              </div>
            </div>

            {/* Answer buttons */}
            <div style={{ display: "flex", gap: 16, flexShrink: 0, width: "100%", position: "relative", zIndex: 10 }}>
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
                position: "relative",
                zIndex: 10,
                animation: "resultFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              }}>
                <p style={{
                  fontSize: 28,
                  fontWeight: 900,
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
                    <p style={{ fontSize: 15.5, color: "#4B5563", lineHeight: 1.65 }}>
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
              {filteredQuestions.map((q, fIdx) => {
                const idx = quiz.questions.findIndex((qq) => qq.id === q.id);
                const ans = answers.get(q.id);
                const status = ans ? (ans.isCorrect ? "correct" : "wrong") : "unanswered";
                const prevSection = fIdx > 0 ? filteredQuestions[fIdx - 1].section : undefined;
                // 셔플 중엔 섹션이 뒤섞여 헤더가 줄마다 반복되므로 숨긴다.
                const showSectionHeader = !shuffleOn && !!q.section && q.section !== prevSection;
                const sectionTotal = q.section
                  ? filteredQuestions.filter((x) => x.section === q.section).length
                  : 0;
                return (
                  <div key={q.id}>
                    {showSectionHeader && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 12px 4px", marginTop: fIdx === 0 ? 0 : 8,
                      }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: "#3787FF",
                          background: "#EBF3FF", borderRadius: 6, padding: "3px 10px",
                        }}>
                          {q.section}
                        </span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{sectionTotal}문항</span>
                      </div>
                    )}
                    <button
                      type="button"
                      data-active={currentIndex === fIdx}
                      onClick={() => { setCurrentIndex(fIdx); setShowList(false); }}
                      className="press"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "12px",
                        background: currentIndex === fIdx ? "#F0F5FF" : "none",
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
                  </div>
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
            {/* 노트 기능 켜기/끄기(끈 상태에서 되돌릴 수 있는 유일한 자리) */}
            <div style={{ padding: "10px 16px 16px", borderTop: "1px solid #F3F4F6" }}>
              <button
                type="button"
                onClick={() => {
                  const next = !noteEnabled;
                  setNoteEnabled(next);
                  try { localStorage.setItem("quiz_note_off", next ? "0" : "1"); } catch {}
                }}
                style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer", padding: 0 }}
              >
                {noteEnabled ? "퀴즈 노트 기능 끄기" : "퀴즈 노트 기능 켜기"}
              </button>
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
          {bookmarkToast}
        </div>
      )}
      <style>{`
        @keyframes toastIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>

      {/* 퀴즈 노트 시트: 내 사고과정/연결 지식 메모(나만 보임, 저장 시 책갈피 추가) */}
      {noteOpen && currentQuestion && (
        <div style={{ position: "fixed", inset: 0, zIndex: 320, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setNoteOpen(false)} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 720, background: "#fff",
            borderRadius: "20px 20px 0 0", padding: "18px 18px calc(16px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
          }}>
            <QuizMemoPad
              ref={memoPadRef}
              text={noteText}
              onTextChange={setNoteText}
              initialDrawing={drawingByQuestion.get(currentQuestion.id) ?? null}
              placeholder={"메모..."}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setNoteOpen(false)} style={{ flex: 1, height: 46, borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff", color: "#4B5563", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                닫기
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={noteSaving}
                style={{ flex: 2, height: 46, borderRadius: 12, border: "none", background: "#3787FF", color: "#fff", fontSize: 15, fontWeight: 800, cursor: noteSaving ? "default" : "pointer", opacity: noteSaving ? 0.6 : 1 }}
              >
                {noteSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 노트가 있는 문제의 책갈피 해제 확인 */}
      {showNoteLossConfirm && (
        <AlertModal
          title="책갈피를 취소할까요?"
          subtitle="이 문제에 저장한 노트도 함께 삭제돼요."
          onClose={() => setShowNoteLossConfirm(false)}
          buttons={[
            { label: "취소하기", bgColor: "#E85D5D", color: "#fff", onClick: toggleBookmark },
            { label: "그대로 두기", bgColor: "#F2F3F5", color: "#51535C", onClick: () => setShowNoteLossConfirm(false) },
          ]}
        />
      )}

      {/* 순서 섞기/되돌리기 확인(진행 중 답이 있을 때만) */}
      {showShuffleConfirm && (
        <AlertModal
          title={shuffleOn ? "원래 순서로 되돌릴까요?" : "문제 순서를 섞을까요?"}
          subtitle={"지금까지 푼 이번 회차 기록이 초기화되고 처음부터 시작해요."}
          onClose={() => setShowShuffleConfirm(false)}
          buttons={[
            { label: shuffleOn ? "되돌리기" : "섞기", onClick: applyShuffleToggle },
            { label: "취소", bgColor: "#F2F3F5", color: "#51535C", onClick: () => setShowShuffleConfirm(false) },
          ]}
        />
      )}

      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowExitConfirm(false)} />
          <div style={{ position: "relative", width: "calc(100% - 32px)", maxWidth: 375, backgroundColor: "#fff", borderRadius: 20, padding: 12, animation: "slideUpAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 4px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2B313D" }}>정말로 나가시겠습니까?</h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => router.back()} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F2F3F5", color: "#51535C", fontSize: 18, fontWeight: 700, border: "none" }}>나가기</button>
              <button type="button" onClick={() => setShowExitConfirm(false)} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#3787FF", color: "#fff", fontSize: 18, fontWeight: 700, border: "none" }}>계속 풀기</button>
            </div>
          </div>
          <style>{`@keyframes slideUpAlert { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}

      {pendingProgress && quiz && (
        <AlertModal
          title="이전에 푼 기록이 있습니다"
          subtitle="이어서 풀까요?"
          buttons={[
            {
              label: "이어서 풀기",
              onClick: () => {
                try {
                  const entries = JSON.parse(pendingProgress.answersJson) as [string, { selected: boolean; isCorrect: boolean }][];
                  if (Array.isArray(entries)) setAnswers(new Map(entries));
                } catch {}
                const targetIdx = Math.min(pendingProgress.currentIndex || 0, Math.max(0, (quiz?.questions.length || 1) - 1));
                setCurrentIndex(targetIdx);
                setPendingProgress(null);
                setProgressReady(true);
              },
            },
            {
              label: "처음부터 풀기",
              bgColor: "#F2F3F5",
              color: "#51535C",
              onClick: () => {
                if (progressKey) {
                  fetch(`/api/quiz-progress?quizKey=${encodeURIComponent(progressKey)}`, { method: "DELETE" }).catch(() => {});
                }
                setPendingProgress(null);
                setProgressReady(true);
              },
            },
          ]}
        />
      )}

      {/* 완료 결과: 정답률 + 상위 % */}
      {result && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} onClick={() => setResult(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 340, background: "#fff", borderRadius: 22, padding: "26px 22px 18px", textAlign: "center", boxShadow: "0 16px 48px rgba(15,23,42,0.2)", animation: "slideUpAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#8A909C" }}>퀴즈 완료!</p>
            <p style={{ margin: "10px 0 2px", fontSize: 44, fontWeight: 800, color: "#3787FF", lineHeight: 1 }}>{result.scorePct}%</p>
            <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#4B5563" }}>정답률 · {result.correct}/{result.total}개 정답</p>
            {result.topPercent != null && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, background: "#FFF4E5", marginBottom: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/fire-hard.svg" alt="" style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#F97316" }}>상위 {result.topPercent}%</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setResult(null)} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F2F3F5", color: "#51535C", fontSize: 16, fontWeight: 700, border: "none" }}>다시 보기</button>
              <button type="button" onClick={() => router.back()} className="press" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#3787FF", color: "#fff", fontSize: 16, fontWeight: 700, border: "none" }}>목록으로</button>
            </div>
          </div>
          <style>{`@keyframes slideUpAlert { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}

// 헤더 공용 스타일
const hIconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, flexShrink: 0, cursor: "pointer", padding: 0,
};

const hRoundBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
  border: "1px solid #E9ECEF", background: "#fff", cursor: "pointer", padding: 0,
};

// 섞기/노트/책갈피 같은 토글형 도구 버튼(활성 시 색·배경 강조).
function hToolBtn(active: boolean, tint: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 10, flexShrink: 0, cursor: "pointer", padding: 0,
    border: `1px solid ${active ? "transparent" : "#EDF0F3"}`,
    background: active ? bg : "#fff",
    color: active ? tint : "#8B95A1",
    transition: "background 0.16s ease, color 0.16s ease",
  };
}
