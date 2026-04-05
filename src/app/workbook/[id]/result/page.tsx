"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface ProblemResult {
  id: string;
  problemId: string;
  selected: number | null;
  isCorrect: boolean;
  problem: {
    id: string;
    order: number;
    questionText: string | null;
    passageImage: string | null;
    answer: number;
  };
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const score = Number(searchParams.get("score") || 0);
  const total = Number(searchParams.get("total") || 0);
  const timeTaken = Number(searchParams.get("time") || 0);
  const attemptId = searchParams.get("attemptId");

  const [results, setResults] = useState<ProblemResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (!attemptId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/attempts?attemptId=${attemptId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.answers || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [attemptId]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const scorePerProblem = total > 0 ? Math.round(100 / total) : 5;
  const totalPoints = score * scorePerProblem;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-end px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="p-2 -mr-2"
        >
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
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score Display */}
      <div className="px-4 pt-4 pb-8 text-center">
        <div className="inline-flex items-baseline gap-1 mb-2">
          <span className="text-5xl font-bold text-gray-900">
            {totalPoints}
          </span>
          <span className="text-2xl text-gray-400">
            /{total * scorePerProblem}점
          </span>
        </div>
        <p className="text-sm text-gray-400">{formatTime(timeTaken)}</p>

        {/* Score bar */}
        <div className="mt-4 mx-auto max-w-xs">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{
                width: `${total > 0 ? (score / total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">
              정답 {score}문제
            </span>
            <span className="text-xs text-gray-400">
              오답 {total - score}문제
            </span>
          </div>
        </div>
      </div>

      {/* Problem Results List */}
      <div className="flex-1 px-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          문제별 결과
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2 pb-24">
            {results
              .sort((a, b) => a.problem.order - b.problem.order)
              .map((result, index) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                >
                  {/* Problem number */}
                  <span className="text-sm font-bold text-gray-500 w-6">
                    {index + 1}
                  </span>

                  {/* Question preview */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {result.problem.questionText || `문제 ${index + 1}`}
                    </p>
                  </div>

                  {/* Correct/Wrong label and score */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        result.isCorrect
                          ? "bg-[#E8F0FE] text-[#4A90D9]"
                          : "bg-[#FFE0E0] text-[#E85D5D]"
                      }`}
                    >
                      {result.isCorrect ? "정답" : "오답"}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        result.isCorrect ? "text-[#4A90D9]" : "text-[#E85D5D]"
                      }`}
                    >
                      {result.isCorrect ? `+${scorePerProblem}점` : "0점"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          /* Fallback: show score-only summary when detailed results are not available */
          <div className="space-y-2 pb-24">
            {Array.from({ length: total }, (_, i) => {
              const isCorrect = i < score;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-bold text-gray-500 w-6">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">문제 {i + 1}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isCorrect
                          ? "bg-[#E8F0FE] text-[#4A90D9]"
                          : "bg-[#FFE0E0] text-[#E85D5D]"
                      }`}
                    >
                      {isCorrect ? "정답" : "오답"}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        isCorrect ? "text-[#4A90D9]" : "text-[#E85D5D]"
                      }`}
                    >
                      {isCorrect ? `+${scorePerProblem}점` : "0점"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3">
        <button
          onClick={() => router.push(`/workbook/${id}/solve`)}
          className="w-full h-14 bg-primary text-white rounded-2xl text-base font-semibold active:bg-blue-600 transition-colors"
        >
          다시풀기
        </button>
      </div>
    </div>
  );
}
