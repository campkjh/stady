"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface RetestItem {
  id: string;
  type: "workbook" | "ox" | "vocab";
  title: string;
  subtitle: string;
  prompt: string;
  answer: number | boolean;
  answerText?: string;
  explanation?: string | null;
  questionImage?: string | null;
  passageImage?: string | null;
  choices?: string[];
  section?: string | null;
}

type Answer = { selected: number | boolean; isCorrect: boolean };

const TYPE_LABEL: Record<RetestItem["type"], string> = {
  workbook: "문제집",
  ox: "OX",
  vocab: "영단어",
};

function RetestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") === "bookmark" ? "bookmark" : "wrong";
  const type = searchParams.get("type") || "all";

  const [items, setItems] = useState<RetestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [showResult, setShowResult] = useState(false);
  const [nonce, setNonce] = useState(0); // bump to restart

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setAnswers(new Map());
    setIndex(0);
    setShowResult(false);
    fetch(`/api/retest?source=${source}&type=${type}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("login");
          throw new Error("fetch");
        }
        return res.json();
      })
      .then((data) => setItems((data.items as RetestItem[]) ?? []))
      .catch((err) =>
        setError(err.message === "login" ? "로그인이 필요합니다." : "문제를 불러오지 못했습니다.")
      )
      .finally(() => setLoading(false));
  }, [source, type, nonce]);

  const current = items[index] ?? null;
  const answered = current ? answers.get(current.id) ?? null : null;
  const correctCount = useMemo(
    () => Array.from(answers.values()).filter((a) => a.isCorrect).length,
    [answers]
  );

  function pick(selected: number | boolean) {
    if (!current || answers.get(current.id)) return;
    const isCorrect = selected === current.answer;
    const next = new Map(answers);
    next.set(current.id, { selected, isCorrect });
    setAnswers(next);
    if (next.size === items.length) {
      // small delay so the last result is visible before the summary
      setTimeout(() => setShowResult(true), 700);
    }
  }

  function goNext() {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function handleTouchEnd() {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 80) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  }

  if (loading) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button type="button" onClick={() => router.back()} style={primaryBtn}>
          돌아가기
        </button>
      </Centered>
    );
  }

  if (items.length === 0) {
    return (
      <Centered>
        <p style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
          {source === "bookmark" ? "찜한 문제가 없어요" : "틀린 문제가 없어요"}
        </p>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
          문제를 풀면 이곳에서 모아 다시 풀 수 있어요.
        </p>
        <button type="button" onClick={() => router.back()} style={primaryBtn}>
          돌아가기
        </button>
      </Centered>
    );
  }

  const headerTitle = source === "bookmark" ? "찜한 문제 모아풀기" : "틀린 문제 모아풀기";

  return (
    <div
      className="flex flex-col bg-white"
      style={{ position: "fixed", inset: 0, maxWidth: 500, margin: "0 auto", overflow: "hidden" }}
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-4 pt-4 pb-2" style={{ position: "relative", zIndex: 20 }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="press"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 15, fontWeight: 900, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {headerTitle}
          </h1>
          <p style={{ fontSize: 12, color: "#8A909C", marginTop: 1 }}>
            {answers.size}/{items.length} 풀이 · {correctCount}개 정답
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowResult(true)}
          className="press"
          style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 800 }}
        >
          결과
        </button>
      </header>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#F1F5F9", margin: "2px 16px 0", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((index + 1) / items.length) * 100}%`, background: "#3787FF", transition: "width 0.25s ease" }} />
      </div>

      {/* Question area */}
      <div
        className="flex flex-1 flex-col px-4 py-5 overflow-y-auto"
        style={{ minHeight: 0 }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchEndX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          touchEndX.current = e.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        {current && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ display: "inline-flex", padding: "3px 9px", borderRadius: 999, background: "#EBF3FF", color: "#3787FF", fontSize: 11, fontWeight: 800 }}>
                {TYPE_LABEL[current.type]}
              </span>
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>{index + 1} / {items.length}</span>
              {current.section && (
                <span style={{ fontSize: 11, color: "#8A909C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {current.section}
                </span>
              )}
            </div>

            {current.passageImage && <img src={current.passageImage} alt="지문" style={imgStyle} />}
            {current.questionImage && <img src={current.questionImage} alt="문제" style={imgStyle} />}

            <h2 style={{ fontSize: current.type === "ox" ? 20 : 18, fontWeight: 800, color: "#111827", lineHeight: 1.5, marginBottom: 20 }}>
              {current.type === "ox" ? "Q. " : ""}{current.prompt}
            </h2>

            {/* Answer input */}
            {current.type === "ox" ? (
              <div style={{ display: "flex", gap: 14, width: "100%" }}>
                {[
                  { val: true, label: "그렇다", icon: "/icons/quiz-o.svg", base: "#E8F0FE" },
                  { val: false, label: "아니다", icon: "/icons/quiz-x.svg", base: "#FFE0E0" },
                ].map(({ val, label, icon, base }) => {
                  const isSelected = answered?.selected === val;
                  const dim = answered && !isSelected;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => pick(val)}
                      disabled={!!answered}
                      style={{
                        flex: 1, aspectRatio: "1/1", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20, border: "none",
                        backgroundColor: answered ? (isSelected ? (answered.isCorrect ? "#E8F0FE" : "#FFE0E0") : "#F9FAFB") : base,
                        opacity: dim ? 0.5 : 1,
                        boxShadow: isSelected ? (answered?.isCorrect ? "inset 0 0 0 2px #3787FF" : "inset 0 0 0 2px #E85D5D") : "none",
                        transition: "opacity 0.2s ease",
                      }}
                    >
                      <img src={icon} alt={label} style={{ width: 60, height: 60 }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {(current.choices ?? []).map((choice, i) => {
                  const num = i + 1;
                  const isAnswer = num === current.answer;
                  const isSelected = answered?.selected === num;
                  let bg = "#F9FAFB";
                  let border = "1px solid #E5E7EB";
                  let color = "#374151";
                  if (answered) {
                    if (isAnswer) {
                      bg = "#E8F0FE"; border = "1px solid #3787FF"; color = "#2563EB";
                    } else if (isSelected) {
                      bg = "#FFE0E0"; border = "1px solid #E85D5D"; color = "#DC2626";
                    }
                  }
                  return (
                    <button
                      key={`${choice}-${i}`}
                      onClick={() => pick(num)}
                      disabled={!!answered}
                      className="press"
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                        padding: "14px 14px", borderRadius: 14, background: bg, border, color,
                        fontSize: 15, fontWeight: isAnswer && answered ? 800 : 600,
                      }}
                    >
                      <span style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: answered && isAnswer ? "#3787FF" : answered && isSelected ? "#E85D5D" : "#E5E7EB",
                        color: answered && (isAnswer || isSelected) ? "#fff" : "#6B7280",
                        fontSize: 12, fontWeight: 800,
                      }}>
                        {num}
                      </span>
                      <span style={{ flex: 1 }}>{choice}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Result + explanation */}
            {answered && (
              <div style={{ marginTop: 22, animation: "retestFadeUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
                <p style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: answered.isCorrect ? "#3787FF" : "#E85D5D" }}>
                  {answered.isCorrect ? "정답" : "오답"}
                </p>
                {current.explanation && (
                  <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: "#F9FAFB" }}>
                    <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.65 }}>{current.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer nav */}
      <div style={{ display: "flex", gap: 10, padding: "10px 16px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #F1F5F9" }}>
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="press"
          style={{ ...navBtn, opacity: index === 0 ? 0.4 : 1 }}
        >
          이전
        </button>
        {index >= items.length - 1 ? (
          <button type="button" onClick={() => setShowResult(true)} className="press" style={{ ...navBtn, flex: 2, background: "#3787FF", color: "#fff", border: "none" }}>
            결과 보기
          </button>
        ) : (
          <button type="button" onClick={goNext} className="press" style={{ ...navBtn, flex: 2, background: "#111827", color: "#fff", border: "none" }}>
            다음
          </button>
        )}
      </div>

      {showResult && (
        <ResultOverlay
          total={items.length}
          answeredCount={answers.size}
          correct={correctCount}
          onRetry={() => setNonce((n) => n + 1)}
          onClose={() => router.back()}
          onReview={() => {
            setShowResult(false);
            const firstWrong = items.findIndex((it) => {
              const a = answers.get(it.id);
              return a && !a.isCorrect;
            });
            if (firstWrong >= 0) setIndex(firstWrong);
          }}
        />
      )}

      <style>{`
        @keyframes retestFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function ResultOverlay({
  total, answeredCount, correct, onRetry, onClose, onReview,
}: {
  total: number; answeredCount: number; correct: number;
  onRetry: () => void; onClose: () => void; onReview: () => void;
}) {
  const rate = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;
  const wrong = answeredCount - correct;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={onReview} />
      <div style={{ position: "relative", width: "100%", maxWidth: 360, background: "#fff", borderRadius: 22, padding: 24, animation: "retestPop 0.3s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 12px 48px rgba(0,0,0,0.2)" }}>
        <p style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#8A909C" }}>모아풀기 결과</p>
        <p style={{ textAlign: "center", fontSize: 44, fontWeight: 900, color: "#3787FF", lineHeight: 1.2, marginTop: 4 }}>
          {correct}<span style={{ fontSize: 20, color: "#9CA3AF", fontWeight: 800 }}> / {total}</span>
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#3787FF" }}>정답 {correct}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E85D5D" }}>오답 {wrong}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>정답률 {rate}%</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={onRetry} className="press" style={{ width: "100%", height: 48, borderRadius: 14, background: "#3787FF", color: "#fff", border: "none", fontSize: 16, fontWeight: 800 }}>
            처음부터 다시 풀기
          </button>
          <button type="button" onClick={onReview} className="press" style={{ width: "100%", height: 48, borderRadius: 14, background: "#F2F3F5", color: "#51535C", border: "none", fontSize: 16, fontWeight: 800 }}>
            틀린 문제 다시 보기
          </button>
          <button type="button" onClick={onClose} className="press" style={{ width: "100%", height: 44, background: "none", color: "#9CA3AF", border: "none", fontSize: 14, fontWeight: 700 }}>
            닫기
          </button>
        </div>
      </div>
      <style>{`@keyframes retestPop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", background: "#fff" }}>
      {children}
    </div>
  );
}

const imgStyle: CSSProperties = { width: "100%", display: "block", borderRadius: 12, border: "1px solid #EEF2F7", marginBottom: 12 };
const primaryBtn: CSSProperties = { padding: "10px 18px", borderRadius: 12, background: "#3787FF", color: "#fff", border: "none", fontSize: 14, fontWeight: 800 };
const navBtn: CSSProperties = { flex: 1, height: 48, borderRadius: 14, background: "#fff", border: "1px solid #E5E7EB", color: "#374151", fontSize: 15, fontWeight: 800 };

export default function RetestPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#3787FF]" />
        </Centered>
      }
    >
      <RetestContent />
    </Suspense>
  );
}
