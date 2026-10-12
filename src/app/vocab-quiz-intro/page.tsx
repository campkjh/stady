"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDailyQuizMessage } from "@/lib/daily-quiz-message";
import VocaHeroScene from "@/components/VocaHeroScene";

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
      <div className="voi-bg" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9A86F0]/30 border-t-[#9A86F0]" />
      </div>
    );
  }

  return (
    <div className="voi-bg" style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => router.back()}
        className="press"
        style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top, 0px))", left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--voi-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        {/* 머리 그림 — 단어장 앞으로 A·B·C 유리 카드와 과일이 떠오른다(VocaHeroScene) */}
        <div style={{ marginBottom: 28 }}>
          <VocaHeroScene />
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--voi-ink)", textAlign: "center", marginBottom: 12 }}>
          하루에 한 번 영단어 퀴즈
        </h1>
        <p style={{ fontSize: 15, color: "var(--voi-ink-soft)", textAlign: "center" }}>
          {isLoggedIn ? dailyMessage : "로그인하고 오늘의 단어 퀴즈를 열어보세요."}
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        {/* 스크롤 칸(overflow)이 카드 그림자를 가장자리에서 자르지 않게 여백을 주고 음수 마진으로 되돌린다. */}
        <div style={{ maxHeight: 332, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, margin: "-32px -32px 0", padding: "32px 32px 24px" }} className="quiz-list-scroll">
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
                className={`press voi-card${completed ? " is-done" : ""}`}
                style={{
                  position: "relative", overflow: "hidden",
                  width: "100%", padding: "16px 22px", borderRadius: 20,
                  fontSize: 16, fontWeight: 700, textAlign: "center", flexShrink: 0,
                  animation: "quizItemFadeUp 0.5s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span>{qs.title}</span>
                  {completed && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <img src="/icons/quiz-clear.svg" alt="" width={16} height={16} style={{ display: "block" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--voi-accent)" }}>완료</span>
                    </span>
                  )}
                </span>
                {inProgress ? (
                  <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 700, color: "var(--voi-accent)" }}>
                    {shown}/{denom} 진행 중
                  </span>
                ) : denom > 0 ? (
                  <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "var(--voi-sub)" }}>
                    {denom}문항
                    {completed && stat?.bestPct != null && (
                      <span style={{ color: "var(--voi-accent)", fontWeight: 700 }}>{` · 최고 ${stat.bestPct}%`}</span>
                    )}
                  </span>
                ) : null}
                {inProgress && (
                  <span style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                    display: "block", backgroundColor: "var(--voi-track)",
                  }}>
                    <span style={{
                      display: "block", height: "100%", width: `${progressPct}%`,
                      background: "var(--voi-bar)",
                    }} />
                  </span>
                )}
              </button>
            );
          })}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--voi-sub)", fontSize: 14 }}>등록된 단어 퀴즈가 없습니다.</p>
          )}
        </div>
        <div className="voi-fade" aria-hidden="true" />
      </div>

      <style>{`
        /* 인트로 전용 색 한 벌(OX 인트로 --oxi-* 와 같은 구조, 색만 보라). 기본=라이트, 다크에서 갈아끼운다.
           --voi-paint 는 배경 그림 자체 — 아래쪽 페이드가 **같은 그림**을 쓰려고 변수로 뺐다. */
        :root {
          --voi-paint:
            radial-gradient(60% 42% at 22% 15%, rgba(150, 124, 255, 0.30) 0%, rgba(150, 124, 255, 0) 70%),
            radial-gradient(56% 40% at 80% 20%, rgba(255, 190, 90, 0.22) 0%, rgba(255, 190, 90, 0) 70%),
            radial-gradient(92% 58% at 50% 108%, rgba(204, 192, 248, 0.60) 0%, rgba(249, 247, 255, 0) 70%),
            linear-gradient(168deg, #FAF8FF 0%, #EFEBFB 46%, #FBF9FF 100%);
          --voi-ink: #231C3F;
          --voi-ink-soft: rgba(35, 28, 63, 0.72);
          --voi-sub: rgba(35, 28, 63, 0.56);
          --voi-accent: #6B4FD8;
          --voi-card-bg: rgba(255, 255, 255, 0.68);
          --voi-card-bd: rgba(54, 36, 112, 0.10);
          --voi-card-sh: 0 10px 28px rgba(70, 48, 140, 0.12);
          --voi-done-bg: rgba(122, 94, 235, 0.13);
          --voi-done-bd: rgba(122, 94, 235, 0.36);
          --voi-track: rgba(54, 36, 112, 0.12);
          --voi-bar: linear-gradient(90deg, #9A86F0 0%, #6B4FD8 100%);
        }
        [data-theme="dark"] {
          --voi-paint:
            radial-gradient(60% 42% at 22% 15%, rgba(130, 100, 255, 0.30) 0%, rgba(130, 100, 255, 0) 70%),
            radial-gradient(56% 40% at 80% 20%, rgba(255, 170, 70, 0.16) 0%, rgba(255, 170, 70, 0) 70%),
            radial-gradient(90% 60% at 50% 108%, rgba(60, 40, 120, 0.55) 0%, rgba(14, 10, 28, 0) 70%),
            linear-gradient(168deg, #130F24 0%, #1D1638 46%, #0E0A1C 100%);
          --voi-ink: #F1EEFB;
          --voi-ink-soft: rgba(255, 255, 255, 0.92);
          --voi-sub: rgba(255, 255, 255, 0.62);
          --voi-accent: #BBAAFF;
          --voi-card-bg: rgba(255, 255, 255, 0.07);
          --voi-card-bd: rgba(255, 255, 255, 0.13);
          --voi-card-sh: 0 10px 30px rgba(0, 0, 0, 0.34);
          --voi-done-bg: rgba(160, 134, 255, 0.16);
          --voi-done-bd: rgba(184, 164, 255, 0.46);
          --voi-track: rgba(255, 255, 255, 0.14);
          --voi-bar: linear-gradient(90deg, #BBAAFF 0%, #7E62EA 100%);
        }
        .voi-bg { background: var(--voi-paint); }
        /* 목록 끝 페이드 — 배경과 **같은 그림**을 같은 자리에 그린 뒤 위쪽만 깎는다(OX 인트로와 같은 방식).
           카드의 조상이 아니라서 mask 를 걸어도 카드 유리가 안 깨진다. */
        .voi-fade {
          position: absolute; left: 0; right: 0; bottom: 0; height: 88px; pointer-events: none;
          background: var(--voi-paint);
          background-size: 100% 100vh;
          background-position: 50% 100%;
          -webkit-mask-image: linear-gradient(to top, #000 45%, transparent 100%);
          mask-image: linear-gradient(to top, #000 45%, transparent 100%);
        }
        .voi-card {
          background: var(--voi-card-bg);
          border: 1px solid var(--voi-card-bd);
          box-shadow: var(--voi-card-sh);
          -webkit-backdrop-filter: blur(16px) saturate(1.15);
          backdrop-filter: blur(16px) saturate(1.15);
          color: var(--voi-ink);
        }
        .voi-card.is-done {
          background: var(--voi-done-bg);
          border-color: var(--voi-done-bd);
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
