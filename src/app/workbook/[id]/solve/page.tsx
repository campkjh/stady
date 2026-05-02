"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import SideTapNavigation from "@/components/SideTapNavigation";

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

function isImageUrl(str: string) {
  return str.startsWith("http://") || str.startsWith("https://");
}

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SolvePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [dwellTimes, setDwellTimes] = useState<Map<string, number>>(new Map());
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const enterTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/workbooks/${id}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setWorkbook(data.workbook);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const problems = workbook?.problems || [];
  const currentProblem = problems[currentIndex];

  // Track dwell time on problem change
  useEffect(() => {
    enterTimeRef.current = Date.now();
  }, [currentIndex]);

  const commitDwell = useCallback((problemId: string) => {
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - enterTimeRef.current) / 1000));
    setDwellTimes((prev) => {
      const next = new Map(prev);
      next.set(problemId, (next.get(problemId) || 0) + diff);
      return next;
    });
    enterTimeRef.current = now;
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= problems.length || !currentProblem) return;
    commitDwell(currentProblem.id);
    setCurrentIndex(index);
    setShowExplanation(false);
  }, [problems.length, currentProblem, commitDwell]);

  const selectAnswer = (problemId: string, choiceNum: number) => {
    if (answers.has(problemId)) return; // 이미 답했으면 재선택 불가
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(problemId, choiceNum);
      return next;
    });
    // dwellTime 즉시 반영 후 해설 오픈
    commitDwell(problemId);
    setShowExplanation(true);
  };

  const goNext = () => {
    if (currentIndex < problems.length - 1) {
      goTo(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  };

  async function handleSubmit() {
    if (!workbook || submitting || !currentProblem) return;
    commitDwell(currentProblem.id);
    setSubmitting(true);

    // 최신 dwellTimes를 즉시 사용하기 위해 setState 반영 후 호출
    // React는 async 불가, 직접 Map 계산
    const finalDwell = new Map(dwellTimes);
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - enterTimeRef.current) / 1000));
    if (currentProblem) {
      finalDwell.set(currentProblem.id, (finalDwell.get(currentProblem.id) || 0) + diff);
    }

    const answerPayload = problems.map((p) => ({
      problemId: p.id,
      selected: answers.get(p.id) ?? null,
      dwellSeconds: finalDwell.get(p.id) ?? 0,
    }));

    try {
      const res = await fetch(`/api/workbooks/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerPayload, timeTaken: elapsed }),
      });
      if (!res.ok) throw new Error("submit failed");
      const data = await res.json();
      router.push(`/workbook/${id}/result?score=${data.score}&total=${data.totalScore}&time=${elapsed}&attemptId=${data.attempt.id}`);
    } catch {
      alert("제출 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  const score = useMemo(() => {
    let s = 0;
    for (const p of problems) {
      const a = answers.get(p.id);
      if (a !== undefined && a === p.answer) s++;
    }
    return s;
  }, [answers, problems]);

  const answeredCount = answers.size;
  const allAnswered = problems.length > 0 && answeredCount === problems.length;
  const selectedAnswer = currentProblem ? answers.get(currentProblem.id) : undefined;
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = isAnswered && currentProblem ? selectedAnswer === currentProblem.answer : false;

  // Single-image choice mode detection
  const hasChoiceImage = currentProblem && isImageUrl(currentProblem.choice1) && currentProblem.choice2 === "_";

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ position: "fixed", inset: 0 }}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workbook || problems.length === 0 || !currentProblem) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ position: "fixed", inset: 0 }}>
        <p className="text-gray-500">문제를 불러올 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-primary font-medium">돌아가기</button>
      </div>
    );
  }

  const choiceLabels = ["①", "②", "③", "④", "⑤"];
  const textChoices = !hasChoiceImage ? [
    currentProblem.choice1,
    currentProblem.choice2,
    currentProblem.choice3,
    currentProblem.choice4,
    ...(currentProblem.choice5 && currentProblem.choice5 !== "_" ? [currentProblem.choice5] : []),
  ] : [];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      maxWidth: 500, margin: "0 auto", background: "#fff",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #F3F4F6", flexShrink: 0, position: "relative", zIndex: 20, background: "#fff" }}>
        <button onClick={() => router.back()} className="press" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F3F4F6", padding: "6px 12px", borderRadius: 20 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{formatMMSS(elapsed)}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#3787FF" }}>{score}점</span>
        </div>

        <button onClick={() => setShowDrawer(true)} className="press" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div style={{ padding: "10px 16px 6px", flexShrink: 0, position: "relative", zIndex: 20, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{currentIndex + 1} / {problems.length}</span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>답변 {answeredCount} · 정답 {score}</span>
        </div>
        <div style={{ height: 4, background: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((currentIndex + 1) / problems.length) * 100}%`, background: "#3787FF", transition: "width 0.3s" }} />
        </div>
      </div>

      <SideTapNavigation
        onPrev={goPrev}
        onNext={goNext}
        prevDisabled={currentIndex === 0}
        nextDisabled={currentIndex >= problems.length - 1}
      />

      {/* Problem area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        {currentProblem.passageImage && (
          <div style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid #F3F4F6", position: "relative", zIndex: 10 }}>
            <img src={currentProblem.passageImage} alt="지문" style={{ width: "100%", display: "block" }} />
          </div>
        )}

        {currentProblem.questionImage && (
          <div style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid #F3F4F6", position: "relative", zIndex: 10 }}>
            <img src={currentProblem.questionImage} alt="문제" style={{ width: "100%", display: "block" }} />
          </div>
        )}

        {currentProblem.questionText && (
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111", lineHeight: 1.6, marginBottom: 14, position: "relative", zIndex: 10 }}>
            {currentProblem.questionText}
          </p>
        )}

        {/* Text choices (if no image) */}
        {!hasChoiceImage && textChoices.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 10 }}>
            {textChoices.map((choice, i) => {
              const n = i + 1;
              const isSelected = selectedAnswer === n;
              const isAns = isAnswered && n === currentProblem.answer;
              const isWrongPick = isAnswered && isSelected && !isCorrect;
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(currentProblem.id, n)}
                  disabled={isAnswered}
                  className="press"
                  style={{
                    textAlign: "left", padding: "14px 16px", borderRadius: 14,
                    border: `1.5px solid ${isAns ? "#3787FF" : isWrongPick ? "#EF4444" : isSelected ? "#3787FF" : "#E5E7EB"}`,
                    background: isAns ? "#EAF2FF" : isWrongPick ? "#FEF2F2" : isSelected ? "#EAF2FF" : "#fff",
                    fontSize: 14, color: "#111", display: "flex", gap: 10, cursor: isAnswered ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontWeight: 700, color: isAns ? "#3787FF" : isWrongPick ? "#EF4444" : "#6B7280" }}>{choiceLabels[i]}</span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating choice image group (bottom sheet) */}
      {hasChoiceImage && (
        <div style={{
          position: "absolute", left: 12, right: 12, bottom: 88,
          background: "#fff", borderRadius: 20,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.12)", border: "1px solid #E5E7EB",
          overflow: "hidden",
          maxHeight: "48vh", display: "flex", flexDirection: "column", zIndex: 10,
        }}>
          {/* Number buttons */}
          <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderBottom: "1px solid #F3F4F6", background: "#FAFBFC" }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const isSelected = selectedAnswer === n;
              const isAns = isAnswered && n === currentProblem.answer;
              const isWrongPick = isAnswered && isSelected && !isCorrect;
              return (
                <button
                  key={n}
                  onClick={() => selectAnswer(currentProblem.id, n)}
                  disabled={isAnswered}
                  className="press"
                  style={{
                    flex: 1, height: 40, borderRadius: 10,
                    border: `1.5px solid ${isAns ? "#3787FF" : isWrongPick ? "#EF4444" : isSelected ? "#3787FF" : "#E5E7EB"}`,
                    background: isAns ? "#3787FF" : isWrongPick ? "#EF4444" : isSelected ? "#3787FF" : "#fff",
                    color: (isSelected || isAns || isWrongPick) ? "#fff" : "#374151",
                    fontSize: 15, fontWeight: 700, cursor: isAnswered ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {/* Choice image (aspect ratio preserved by img) */}
          <div style={{ overflow: "auto", flex: 1, background: "#F9FAFB" }}>
            <img src={currentProblem.choice1} alt="선택지" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        borderTop: "1px solid #F3F4F6", background: "#fff",
        display: "flex", gap: 8, flexShrink: 0, zIndex: 20,
      }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="press"
          style={{
            flex: "0 0 auto", height: 48, padding: "0 18px", borderRadius: 12,
            background: "#F3F4F6", border: "none", fontSize: 14, fontWeight: 600, color: "#374151",
            opacity: currentIndex === 0 ? 0.4 : 1,
          }}
        >
          이전
        </button>
        {allAnswered && currentIndex === problems.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="press"
            style={{
              flex: 1, height: 48, borderRadius: 12,
              background: "#3787FF", border: "none", fontSize: 15, fontWeight: 700, color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "채점 중..." : "채점하기"}
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={currentIndex >= problems.length - 1}
            className="press"
            style={{
              flex: 1, height: 48, borderRadius: 12,
              background: isAnswered ? "#3787FF" : "#E5E7EB",
              border: "none", fontSize: 15, fontWeight: 700,
              color: isAnswered ? "#fff" : "#9CA3AF",
              opacity: currentIndex >= problems.length - 1 ? 0.4 : 1,
            }}
          >
            다음
          </button>
        )}
      </div>

      {/* Explanation modal (slides up from bottom) */}
      {showExplanation && isAnswered && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div
            onClick={() => setShowExplanation(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }}
          />
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            maxWidth: 500, margin: "0 auto",
            background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            animation: "explanationSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            maxHeight: "70vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "4px 12px", borderRadius: 20,
                  background: isCorrect ? "#E8F0FE" : "#FEE2E2",
                  color: isCorrect ? "#3787FF" : "#EF4444",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {isCorrect ? "정답!" : "오답"}
                </span>
                <span style={{ fontSize: 13, color: "#6B7280" }}>
                  정답 <b style={{ color: "#111" }}>{currentProblem.answer}번</b>
                </span>
              </div>
              <button
                onClick={() => setShowExplanation(false)}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "#F3F4F6", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 8 }}>해설</h3>
            {currentProblem.explanation ? (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151", whiteSpace: "pre-wrap" }}>
                {currentProblem.explanation}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>해설이 아직 준비되지 않았습니다.</p>
            )}

            {currentIndex < problems.length - 1 && (
              <button
                onClick={() => { setShowExplanation(false); goNext(); }}
                className="press"
                style={{
                  width: "100%", marginTop: 18, height: 48, borderRadius: 12,
                  background: "#3787FF", border: "none", color: "#fff",
                  fontSize: 15, fontWeight: 700,
                }}
              >
                다음 문제
              </button>
            )}
          </div>
          <style>{`
            @keyframes explanationSlide {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Hamburger drawer */}
      {showDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
          <div
            onClick={() => setShowDrawer(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width: "82%", maxWidth: 360, background: "#fff",
            animation: "drawerSlide 0.25s ease",
            boxShadow: "-6px 0 24px rgba(0,0,0,0.12)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>문제 목록</h3>
                <button onClick={() => setShowDrawer(false)} style={{ background: "none", border: "none" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
                <span style={{ color: "#6B7280" }}>전체 <b style={{ color: "#111" }}>{problems.length}</b></span>
                <span style={{ color: "#3787FF" }}>정답 <b>{score}</b></span>
                <span style={{ color: "#EF4444" }}>오답 <b>{answers.size - score}</b></span>
                <span style={{ color: "#9CA3AF" }}>미답 <b>{problems.length - answers.size}</b></span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {problems.map((p, idx) => {
                const sel = answers.get(p.id);
                const hasAnswered = sel !== undefined;
                const correct = hasAnswered && sel === p.answer;
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={p.id}
                    onClick={() => { goTo(idx); setShowDrawer(false); }}
                    className="press"
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "12px 14px", borderRadius: 12,
                      background: isCurrent ? "#F0F5FF" : "transparent",
                      border: "none", textAlign: "left", cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff",
                      background: !hasAnswered ? "#D1D5DB" : correct ? "#3787FF" : "#EF4444",
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        문제 {idx + 1}
                      </p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        {hasAnswered ? `${sel}번 선택` : "아직 풀지 않음"}
                      </p>
                    </div>
                    {hasAnswered && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: correct ? "#3787FF" : "#EF4444",
                        padding: "2px 8px", borderRadius: 10,
                        background: correct ? "#E8F0FE" : "#FEE2E2",
                      }}>
                        {correct ? "정답" : "오답"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <style>{`
            @keyframes drawerSlide {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
