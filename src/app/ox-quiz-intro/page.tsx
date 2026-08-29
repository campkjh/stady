"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDailyQuizMessage } from "@/lib/daily-quiz-message";

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  category?: { id: string; name: string } | null;
  questions?: { section: string | null }[];
  isPremium?: boolean; // 생윤·윤사 앞 5개 이후 = 프리미엄 잠금
}

interface QuizSummaryEntry {
  answered: number;
  total: number;
  completed: boolean;
  bestPct: number | null;
}

type QuizSummaryMap = Record<string, QuizSummaryEntry>;

export default function OxQuizListPage() {
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<OxQuizSet[]>([]);
  const [summary, setSummary] = useState<QuizSummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const dailyMessage = getDailyQuizMessage("ox");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" })
        .then((res) => res.ok)
        .catch(() => false),
      fetch("/api/ox-quiz")
        .then((res) => res.json())
        .then((data) => data.oxQuizSets ?? [])
        .catch(() => []),
      // 진행 상태 요약. 실패해도 목록은 그대로 뜨도록 항상 빈 객체로 폴백한다.
      fetch("/api/quiz-summary", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => (data?.ox ?? {}) as QuizSummaryMap)
        .catch(() => ({} as QuizSummaryMap)),
      // 프리미엄 구독 여부 — 잠금 배지/이동 분기용
      fetch("/api/iap/status", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => !!data?.entitlement?.active)
        .catch(() => false),
    ]).then(([loggedIn, sets, oxSummary, premium]) => {
      setIsLoggedIn(loggedIn);
      setQuizSets(sets);
      setSummary(oxSummary);
      setIsPremiumUser(premium);
      setLoading(false);
    });
  }, []);

  function requireLoginThen(action: () => void) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    action();
  }

  // 세트 열기 — 프리미엄 잠금이면 결제 화면으로, 아니면 로그인 확인 후 풀이 화면으로.
  function openSet(qs: OxQuizSet) {
    if (qs.isPremium && !isPremiumUser) {
      requireLoginThen(() => router.push("/subscribe"));
      return;
    }
    requireLoginThen(() => router.push(`/ox-quiz/${qs.id}`));
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--ox-intro-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const groups = quizSets.reduce<{ name: string; items: OxQuizSet[] }[]>((acc, qs) => {
    const name = qs.category?.name ? `${qs.category.name} OX 퀴즈` : "OX 퀴즈";
    const group = acc.find((item) => item.name === name);
    if (group) group.items.push(qs);
    else acc.push({ name, items: [qs] });
    return acc;
  }, []);
  const selectedGroup = groups.find((group) => group.name === selectedGroupName) ?? null;

  // 세트의 문항 수. 요약의 라이브 COUNT 가 있으면 그것을, 없으면 비정규화 컬럼으로 폴백한다.
  // (OxQuizSet.totalQuestions 는 어드민 입력값이라 실제 문항 수와 어긋날 수 있다.)
  // 그룹 합계와 세트 카드가 반드시 같은 값을 쓰도록 한 곳에 모아둔다.
  function denomOf(qs: OxQuizSet): number {
    const stat = summary[qs.id];
    return stat && stat.total > 0 ? stat.total : qs.totalQuestions;
  }


  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 720, margin: "0 auto", backgroundColor: "var(--ox-intro-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => selectedGroup ? setSelectedGroupName(null) : router.back()}
        className="press"
        style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top, 0px))", left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        {/* OX Blocks */}
        <div style={{ display: "flex", gap: 16, marginBottom: 48, animation: "oxBlockAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={{
            width: 120, height: 120, borderRadius: 24,
            backgroundColor: "var(--c-brand-deep-7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 28px rgba(46,117,227,0.35)",
            animation: "oxBounceL 2.2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 90, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -2 }}>O</span>
          </div>
          <div style={{
            width: 120, height: 120, borderRadius: 24,
            backgroundColor: "var(--c-danger-k)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 28px rgba(232,69,60,0.35)",
            animation: "oxBounceR 2.2s ease-in-out 0.3s infinite",
          }}>
            <span style={{ fontSize: 90, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -2 }}>X</span>
          </div>
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 12 }}>
          하루에 한 번 OX퀴즈
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", textAlign: "center" }}>
          {isLoggedIn ? dailyMessage : "로그인하고 오늘의 퀴즈를 열어보세요."}
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }} className="quiz-list-scroll">
          {!selectedGroup && groups.map((group, index) => {
            // 그룹 합계도 세트 카드와 **같은 분모 규칙**을 써야 한다.
            // 여기만 비정규화 totalQuestions 를 쓰면, 실제 문항이 30개인데 컬럼이 25인 세트에서
            // 그룹은 "25문항", 들어가서 보는 카드는 "30문항" 으로 같은 세트가 다르게 보인다.
            const totalQuestions = group.items.reduce((sum, item) => sum + denomOf(item), 0);
            const doneCount = group.items.filter((item) => summary[item.id]?.completed).length;
            const allDone = group.items.length > 0 && doneCount === group.items.length;
            return (
              <button
                key={group.name}
                type="button"
                onClick={() => requireLoginThen(() => setSelectedGroupName(group.name))}
                className="press"
                style={{
                  width: "100%", padding: "20px 18px", borderRadius: 18,
                  backgroundColor: allDone ? "var(--c-brand-soft-2)" : "var(--c-bg)",
                  border: `1.5px solid ${allDone ? "var(--c-brand-line-10)" : "transparent"}`,
                  color: "var(--c-text-2)", textAlign: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)", flexShrink: 0,
                  animation: "quizItemFadeUp 0.5s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 17, fontWeight: 900 }}>
                  <span>{group.name}</span>
                  {allDone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <img src="/icons/quiz-allclear.svg" alt="" width={18} height={18} style={{ display: "block" }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--c-brand)" }}>전체 완료</span>
                    </span>
                  )}
                </span>
                <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--c-text-4)" }}>
                  {group.items.length}개 중분류 · {totalQuestions}문항
                  {doneCount > 0 && (
                    <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>
                      {` · ${doneCount}/${group.items.length} 단원 완료`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {selectedGroup && (
            <div>
              <p style={{
                fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.95)",
                margin: "4px 4px 8px", letterSpacing: 0.2,
              }}>
                {selectedGroup.name}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {selectedGroup.items.map((qs, index) => {
                  // 소분류가 세트 제목과 같으면(단원 단위로 분리된 세트) 중복 태그이므로 숨긴다.
                  const sections = (
                    Array.from(new Set((qs.questions ?? []).map((q) => q.section).filter(Boolean))) as string[]
                  ).filter((s) => s.trim() !== qs.title.trim());
                  const stat = summary[qs.id];
                  const denom = denomOf(qs);
                  const answered = stat?.answered ?? 0;
                  const completed = stat?.completed ?? false;
                  const inProgress = !completed && answered > 0;
                  const progressPct = denom > 0 ? Math.min(100, Math.round((answered / denom) * 100)) : 0;
                  const locked = !!qs.isPremium && !isPremiumUser;
                  return (
                    <button
                      key={qs.id}
                      type="button"
                      onClick={() => openSet(qs)}
                      className="press"
                      style={{
                        position: "relative", overflow: "hidden",
                        width: "100%", padding: "16px 18px", borderRadius: 18,
                        backgroundColor: completed ? "var(--c-brand-soft-2)" : "var(--c-bg)",
                        border: `1.5px solid ${completed ? "var(--c-brand-line-10)" : "transparent"}`,
                        color: "var(--c-text-2)", textAlign: "left",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.1)", flexShrink: 0,
                        animation: "quizItemFadeUp 0.5s",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 15, fontWeight: 800, textAlign: "center", opacity: locked ? 0.85 : 1 }}>
                        {locked && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <path d="M7 10V8a5 5 0 0110 0v2" stroke="var(--c-text-4)" strokeWidth="2" strokeLinecap="round" />
                            <rect x="5" y="10" width="14" height="9" rx="2.5" fill="var(--c-text-4)" />
                          </svg>
                        )}
                        <span>{qs.title}</span>
                        {locked && (
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "var(--c-warn-i-deep, #B8860B)", background: "var(--c-warn-i, #FFF3D6)", borderRadius: 999, padding: "2px 7px" }}>프리미엄</span>
                        )}
                        {completed && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            <img src="/icons/quiz-clear.svg" alt="" width={16} height={16} style={{ display: "block" }} />
                            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--c-brand)" }}>완료</span>
                          </span>
                        )}
                      </span>
                      <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "var(--c-text-4)", textAlign: "center" }}>
                        {sections.length > 0 ? `${sections.length}개 소분류 · ` : ""}{denom}문항
                        {completed && stat?.bestPct != null && (
                          <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>{` · 최고 ${stat.bestPct}%`}</span>
                        )}
                        {inProgress && (
                          <span style={{ color: "var(--c-brand)", fontWeight: 800 }}>{` · ${answered}/${denom} 진행 중`}</span>
                        )}
                      </span>
                      {sections.length > 0 && (
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
                          {sections.slice(0, 4).map((section) => (
                            <span
                              key={section}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                // 완료 카드는 배경이 이미 brand-soft-2 라 칩이 묻힌다 → 카드 면색으로 뒤집는다.
                                backgroundColor: completed ? "var(--c-bg)" : "var(--c-brand-soft-2)",
                                color: "var(--c-brand)",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {section}
                            </span>
                          ))}
                          {sections.length > 4 && (
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              // 넘침 칩도 일반 칩과 같은 completed 분기 → 완료 카드에서 배경에 묻히지 않는다.
                              backgroundColor: completed ? "var(--c-bg)" : "var(--c-bg-muted)",
                              color: "var(--c-text-4)",
                              fontSize: 11,
                              fontWeight: 700,
                            }}>
                              +{sections.length - 4}
                            </span>
                          )}
                        </span>
                      )}
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
              </div>
            </div>
          )}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 14 }}>등록된 OX 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, var(--ox-intro-bg), transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        /* 인트로 배경은 브랜드 색이라 테마와 무관하게 두고 싶지만, 카드는 테마를 따르므로
           다크에서 '밝은 하늘색 배경 + 검은 카드'가 되어 부딪힌다. 배경만 같은 색상의 어두운 톤으로 낮춘다. */
        :root { --ox-intro-bg: #7BC5E8; }
        [data-theme="dark"] { --ox-intro-bg: #14313F; }
        @keyframes oxBlockAppear {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes oxBounceL {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes oxBounceR {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
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
