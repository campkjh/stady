"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDailyQuizMessage } from "@/lib/daily-quiz-message";

interface VocabQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
}

interface QuizSummaryEntry {
  answered: number;
  total: number;
  completed: boolean;
  bestPct: number | null;
}

type QuizSummaryMap = Record<string, QuizSummaryEntry>;

export default function VocabQuizListPage() {
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<VocabQuizSet[]>([]);
  const [summary, setSummary] = useState<QuizSummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const dailyMessage = getDailyQuizMessage("vocab");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" })
        .then((res) => res.ok)
        .catch(() => false),
      fetch("/api/vocab-quiz")
        .then((res) => res.json())
        .then((data) => data.vocabQuizSets ?? [])
        .catch(() => []),
    ]).then(([loggedIn, sets]) => {
      setIsLoggedIn(loggedIn);
      setQuizSets(sets);
      setLoading(false);
    });

    // 진행 상태 요약은 독립 체인. 목록 렌더(loading)를 절대 막지 않고 나중에 채워진다.
    fetch("/api/quiz-summary", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSummary((d?.vocab ?? {}) as QuizSummaryMap))
      .catch(() => {});
  }, []);

  function openQuiz(quizId: string) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(`/vocab-quiz/${quizId}`);
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, var(--voca-intro-top) 0%, var(--voca-intro-bottom) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7EA6E8]/30 border-t-[#7EA6E8]" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto", background: "linear-gradient(180deg, var(--voca-intro-top) 0%, var(--voca-intro-bottom) 100%)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => router.back()}
        className="press"
        style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-brand-mid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--c-brand-mid)", textAlign: "center", marginBottom: 28 }}>
          영단어 퀴즈
        </h1>

        {/* Stacked VOCA Cards */}
        <div style={{ position: "relative", width: 240, height: 140, marginBottom: 28 }}>
          <div style={{
            position: "absolute", right: -8, top: 8, width: 220, height: 130,
            borderRadius: 18, backgroundColor: "var(--c-bg-a60)",
            boxShadow: "0 6px 20px rgba(126,166,232,0.15)",
            animation: "vocaCardBack 3s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", left: 0, top: 0, width: 220, height: 130,
            borderRadius: 18, backgroundColor: "var(--c-bg)",
            boxShadow: "0 10px 28px rgba(126,166,232,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--c-brand-line-6)",
            animation: "vocaCardFront 3s ease-in-out infinite",
          }}>
            <span style={{
              fontSize: 56, fontWeight: 900, letterSpacing: -2,
              color: "var(--c-text-5g)",
              textShadow: "0 3px 8px rgba(126,166,232,0.25)",
            }}>
              VOCA
            </span>
          </div>
        </div>

        <p style={{ fontSize: 18, color: "var(--c-text-5f)", textAlign: "center", fontWeight: 700 }}>
          {isLoggedIn ? dailyMessage : "로그인하고 오늘의 단어 퀴즈를 열어보세요."}
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }} className="quiz-list-scroll">
          {quizSets.map((qs) => {
            const stat = summary[qs.id];
            // 분모는 요약의 라이브 total 우선, 없거나 0이면 목록이 이미 가진 totalQuestions.
            const denom = stat?.total && stat.total > 0 ? stat.total : (qs.totalQuestions ?? 0);
            const answered = stat?.answered ?? 0;
            const completed = stat?.completed === true;
            const inProgress = !completed && answered > 0;
            const progressPct = denom > 0 ? Math.min(100, Math.round((answered / denom) * 100)) : 0;
            // 표시용 분자는 분모를 넘지 않게 클램프("30/25 진행 중" 방지).
            const shown = Math.min(answered, denom);
            return (
              <button
                key={qs.id}
                type="button"
                onClick={() => openQuiz(qs.id)}
                className="press"
                style={{
                  position: "relative", overflow: "hidden",
                  width: "100%", padding: "16px 22px", borderRadius: 20,
                  backgroundColor: completed ? "var(--c-brand-soft-2)" : "var(--c-bg)",
                  border: `1px solid ${completed ? "var(--c-brand-line-9)" : "var(--c-brand-line-7)"}`,
                  fontSize: 16, fontWeight: 700, color: "var(--c-text-2)", textAlign: "center",
                  boxShadow: "0 4px 16px rgba(126,166,232,0.12)", flexShrink: 0,
                  animation: "quizItemFadeUp 0.5s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span>{qs.title}</span>
                  {completed && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <img src="/icons/quiz-clear.svg" alt="" width={16} height={16} style={{ display: "block" }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--c-brand)" }}>완료</span>
                    </span>
                  )}
                </span>
                {inProgress ? (
                  <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 800, color: "var(--c-brand)" }}>
                    {shown}/{denom} 진행 중
                  </span>
                ) : denom > 0 ? (
                  <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "var(--c-text-4)" }}>
                    {denom}문항
                    {completed && stat?.bestPct != null && (
                      <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>{` · 최고 ${stat.bestPct}%`}</span>
                    )}
                  </span>
                ) : null}
                {inProgress && (
                  <span style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                    display: "block", backgroundColor: "var(--c-bg-muted)",
                  }}>
                    <span style={{
                      display: "block", height: "100%", width: `${progressPct}%`,
                      background: "linear-gradient(90deg, var(--c-brand) 0%, var(--c-brand-deep-7) 100%)",
                    }} />
                  </span>
                )}
              </button>
            );
          })}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--c-text-5f)", fontSize: 14 }}>등록된 단어 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, var(--voca-intro-bottom), transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        /* OX 인트로와 같은 이유: 배경만 어두운 톤으로 낮춰야 다크에서 카드와 부딪히지 않는다. */
        :root { --voca-intro-top: #E8F0FE; --voca-intro-bottom: #DEE9FB; }
        [data-theme="dark"] { --voca-intro-top: #171B26; --voca-intro-bottom: #1C2130; }
        @keyframes vocaCardFront {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(-1deg); }
        }
        @keyframes vocaCardBack {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
