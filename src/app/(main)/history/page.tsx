"use client";

import { useEffect, useState } from "react";

interface QuizAttempt {
  id: string;
  quizType: string;
  score: number;
  totalScore: number;
  timeTaken: number;
  completedAt: string;
  workbook: { id: string; title: string; thumbnail: string | null } | null;
  oxQuizSet: { id: string; title: string; thumbnail: string | null } | null;
  vocabQuizSet: { id: string; title: string; thumbnail: string | null } | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function getQuizTypeLabel(type: string): string {
  switch (type) {
    case "workbook":
      return "문제집";
    case "ox":
      return "OX 퀴즈";
    case "vocab":
      return "단어 퀴즈";
    default:
      return type;
  }
}

function getQuizTypeColor(type: string): string {
  switch (type) {
    case "workbook":
      return "bg-blue-100 text-blue-700";
    case "ox":
      return "bg-emerald-100 text-emerald-700";
    case "vocab":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/attempts")
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("login");
          throw new Error("fetch");
        }
        return res.json();
      })
      .then((data) => setAttempts(data.attempts || []))
      .catch((err) => {
        if (err.message === "login") {
          setError("로그인이 필요합니다.");
        } else {
          setError("데이터를 불러오는 중 오류가 발생했습니다.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function getTitle(attempt: QuizAttempt): string {
    if (attempt.workbook) return attempt.workbook.title;
    if (attempt.oxQuizSet) return attempt.oxQuizSet.title;
    if (attempt.vocabQuizSet) return attempt.vocabQuizSet.title;
    return "알 수 없음";
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-4" style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff" }}>
        <h1 className="text-lg font-bold text-gray-800">풀이내역</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#4A90D9]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="mt-3 text-sm">{error}</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="mt-3 text-sm">풀이내역이 없습니다.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {attempts.map((attempt) => {
            const scorePercent =
              attempt.totalScore > 0
                ? Math.round((attempt.score / attempt.totalScore) * 100)
                : 0;

            return (
              <li key={attempt.id} className="flex items-center gap-3 px-4 py-4">
                {/* Score Circle */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    scorePercent >= 80
                      ? "bg-blue-50 text-[#4A90D9]"
                      : scorePercent >= 50
                        ? "bg-amber-50 text-amber-600"
                        : "bg-red-50 text-red-500"
                  }`}
                >
                  {scorePercent}%
                </div>

                {/* Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getQuizTypeColor(attempt.quizType)}`}
                    >
                      {getQuizTypeLabel(attempt.quizType)}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-800">
                      {getTitle(attempt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>
                      {attempt.score}/{attempt.totalScore}점
                    </span>
                    <span>{formatTime(attempt.timeTaken)}</span>
                    <span>{formatDate(attempt.completedAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
