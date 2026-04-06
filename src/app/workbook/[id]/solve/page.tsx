"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Problem {
  id: string;
  order: number;
  passageImage: string | null;
  questionImage: string | null;
  questionText: string | null;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice5: string | null;
  answer: number;
  explanation: string | null;
}

interface Workbook {
  id: string;
  title: string;
  problems: Problem[];
}

const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];

function isImageUrl(str: string) {
  return str.startsWith("http://") || str.startsWith("https://");
}

export default function SolvePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"assistant" | "ai">("assistant");

  // Swipe state
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch workbook
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/workbooks/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setWorkbook(data.workbook);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const problems = workbook?.problems || [];
  const currentProblem = problems[currentIndex];
  const allAnswered = problems.length > 0 && answers.size === problems.length;

  function formatTimer(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function selectAnswer(problemId: string, choiceIndex: number) {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(problemId, choiceIndex);
      return next;
    });
  }

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < problems.length) {
        setCurrentIndex(index);
      }
    },
    [problems.length]
  );

  // Swipe handlers
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0].clientX;
  }

  function onTouchEnd() {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) {
      goTo(currentIndex + 1);
    } else if (diff < -threshold) {
      goTo(currentIndex - 1);
    }
  }

  async function handleSubmit() {
    if (!workbook || submitting) return;
    setSubmitting(true);

    const answerPayload = problems.map((p) => ({
      problemId: p.id,
      selected: answers.get(p.id) ?? null,
    }));

    try {
      const res = await fetch(`/api/workbooks/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerPayload, timeTaken: elapsed }),
      });

      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();

      // Navigate to result page with query params
      router.push(
        `/workbook/${id}/result?score=${data.score}&total=${data.totalScore}&time=${elapsed}&attemptId=${data.attempt.id}`
      );
    } catch (err) {
      console.error(err);
      alert("제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ position: "fixed", inset: 0 }}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workbook || problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ position: "fixed", inset: 0 }}>
        <p className="text-gray-500">문제를 불러올 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="text-primary font-medium"
        >
          돌아가기
        </button>
      </div>
    );
  }

  // 단일 이미지 선택지 모드: choice1이 URL이고 choice2가 "_"인 경우
  const isSingleImageMode = currentProblem
    ? isImageUrl(currentProblem.choice1) && currentProblem.choice2 === "_"
    : false;

  const choices = currentProblem
    ? isSingleImageMode
      ? []
      : [
          currentProblem.choice1,
          currentProblem.choice2,
          currentProblem.choice3,
          currentProblem.choice4,
          ...(currentProblem.choice5 && currentProblem.choice5 !== "_" ? [currentProblem.choice5] : []),
        ]
    : [];

  const selectedAnswer = currentProblem
    ? answers.get(currentProblem.id)
    : undefined;

  return (
    <div className="bg-white flex flex-col" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 500, margin: "0 auto" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Timer */}
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-full px-4 py-1.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-sm font-medium text-gray-700 tabular-nums">
            {formatTimer(elapsed)}
          </span>
        </div>

        {/* Problem count */}
        <span className="text-sm text-gray-400">
          {currentIndex + 1}/{problems.length}
        </span>
      </div>

      {/* Problem Navigation Dots */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
          {problems.map((p, i) => {
            const isActive = i === currentIndex;
            const isAnswered = answers.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => goTo(i)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : isAnswered
                      ? "bg-primary/20 text-primary"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Problem Content - Swipeable */}
      <div
        ref={containerRef}
        className="flex-1 px-4 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Passage Image */}
        {currentProblem.passageImage && (
          <div className="mb-4 rounded-xl overflow-hidden border border-gray-100">
            <img
              src={currentProblem.passageImage}
              alt="지문"
              className="w-full"
            />
          </div>
        )}

        {/* Question Image */}
        {currentProblem.questionImage && (
          <div className="mb-4 rounded-xl overflow-hidden border border-gray-100">
            <img
              src={currentProblem.questionImage}
              alt="문제"
              className="w-full"
            />
          </div>
        )}

        {/* Question Text */}
        {currentProblem.questionText && (
          <div className="mb-6">
            <p className="text-base font-medium text-gray-900 leading-relaxed">
              {currentProblem.questionText}
            </p>
          </div>
        )}

        {/* Choices */}
        {isSingleImageMode ? (
          <div className="pb-4">
            {/* 선택지 이미지 */}
            <div className="mb-4 rounded-xl overflow-hidden border border-gray-100">
              <img
                src={currentProblem.choice1}
                alt="선택지"
                className="w-full"
              />
            </div>
            {/* 번호 버튼 */}
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => {
                const isSelected = selectedAnswer === n;
                return (
                  <button
                    key={n}
                    onClick={() => selectAnswer(currentProblem.id, n)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold transition-colors ${
                      isSelected
                        ? "bg-primary text-white border-2 border-primary"
                        : "bg-white text-gray-700 border-2 border-gray-200 active:bg-gray-50"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {choices.map((choice, i) => {
              const choiceNum = i + 1;
              const isSelected = selectedAnswer === choiceNum;
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(currentProblem.id, choiceNum)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-gray-700 active:bg-gray-50"
                  }`}
                >
                  <span className="font-medium mr-2">{CIRCLE_LABELS[i]}</span>
                  <span className="text-sm">{choice}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Tabs */}
      <div className="border-t border-gray-100">
        {/* Tab buttons */}
        <div className="flex">
          <button
            onClick={() => setActiveTab("assistant")}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              activeTab === "assistant"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400"
            }`}
          >
            어시스턴트
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              activeTab === "ai"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400"
            }`}
          >
            스타디 AI 해설보기
          </button>
        </div>

        {/* Grade button (shows when all answered) */}
        {allAnswered && (
          <div className="px-4 py-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 bg-primary text-white rounded-2xl text-base font-semibold active:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? "채점 중..." : "채점하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
