"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientCache } from "@/lib/clientCache";

const CACHE_KEY = "daily-quiz";

interface DailyQuestion {
  id: string;
  text: string;
  categoryName: string;
  title: string;
}

interface DailyStats {
  total: number;
  correct: number;
  correctRate: number;
}

interface DailyData {
  date: string;
  question: DailyQuestion | null;
  answered?: boolean;
  mySelected?: boolean | null;
  correctAnswer?: boolean | null;
  myCorrect?: boolean | null;
  stats?: DailyStats | null;
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DailyQuizCard() {
  // 캐시된 값이 있으면 즉시 표시(재방문 시 깜빡임 없음).
  const [data, setData] = useState<DailyData | null>(() => clientCache.get<DailyData>(CACHE_KEY) ?? null);
  const [loaded, setLoaded] = useState(() => clientCache.has(CACHE_KEY));
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 과목 설정 ──────────────────────────────────────────────
  // 예전엔 전체 문항에서 뽑아 그날그날 과목이 달라졌다("사문이랑 생윤이 랜덤하게 나온다").
  // 여기서 고른 과목에서만 오늘의 문제가 나온다. 아무것도 고르지 않으면 전체.
  const [prefOpen, setPrefOpen] = useState(false);
  const [prefOptions, setPrefOptions] = useState<{ id: string; name: string; count: number }[]>([]);
  const [prefSelected, setPrefSelected] = useState<string[]>([]);
  const [prefSaving, setPrefSaving] = useState(false);

  async function openPref() {
    setPrefOpen(true);
    try {
      const res = await fetch("/api/daily-quiz/preferences", { credentials: "include" });
      const data = await res.json();
      setPrefOptions(Array.isArray(data?.options) ? data.options : []);
      setPrefSelected(Array.isArray(data?.selected) ? data.selected : []);
    } catch {
      /* 목록을 못 받아도 시트는 열려 있는다 — 다시 열면 재시도 */
    }
  }

  async function savePref(next: string[]) {
    setPrefSaving(true);
    try {
      const res = await fetch("/api/daily-quiz/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categoryIds: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setPrefOpen(false);
      window.location.reload(); // 고른 과목으로 오늘의 문제를 다시 받는다.
    } catch {
      setPrefSaving(false);
    }
  }

  // 오늘의 데일리 퀴즈 로드(백그라운드 재검증, 달라졌을 때만 갱신).
  useEffect(() => {
    let alive = true;
    fetch("/api/daily-quiz", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: DailyData | null) => {
        if (!alive) return;
        if (clientCache.set(CACHE_KEY, d)) setData(d);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const answered = !!data?.answered;
  const hasQuestion = !!data?.question;

  // 미응답 동안 경과 시간 카운트업(이미지의 우상단 타이머).
  useEffect(() => {
    if (!hasQuestion || answered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasQuestion, answered]);

  const submit = useCallback(
    async (selected: boolean) => {
      if (submitting || answered || !data?.question) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/daily-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ selected }),
        });
        const r = await res.json();
        if (!res.ok) {
          setSubmitting(false);
          return;
        }
        setIsGuest(!!r.guest);
        setXpGained(r.xpGained ?? 0);
        setData((prev) => {
          if (!prev) return prev;
          const next: DailyData = {
            ...prev,
            answered: true,
            mySelected: r.mySelected,
            correctAnswer: r.correctAnswer,
            myCorrect: r.isCorrect,
            stats: r.stats,
          };
          // 응답 결과를 캐시에 반영 → 다른 탭 갔다 와도 답한 상태 유지.
          clientCache.set(CACHE_KEY, next);
          return next;
        });
      } catch {
        // 네트워크 오류 시 그대로 둠(재시도 가능)
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, answered, data]
  );

  if (!loaded || !hasQuestion || !data?.question) return null;

  const q = data.question;
  const correctAnswer = data.correctAnswer; // true=예, false=아니요 (응답 후에만 존재)
  const mySelected = data.mySelected;
  const myCorrect = data.myCorrect;
  const stats = data.stats;

  // 응답 후 각 버튼의 스타일 결정.
  function optionStyle(optValue: boolean): React.CSSProperties {
    const base: React.CSSProperties = {
      width: "100%",
      textAlign: "left",
      padding: "0 18px",
      height: 54,
      borderRadius: 16,
      border: "none",
      fontSize: 16,
      fontWeight: 600,
      color: "var(--c-text-2e)",
      background: "var(--c-bg-muted-13)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: answered ? "default" : "pointer",
    };
    if (!answered) return base;
    const isCorrectOpt = correctAnswer === optValue;
    const isMine = mySelected === optValue;
    if (isCorrectOpt) {
      return { ...base, background: "var(--c-brand-soft)", boxShadow: "inset 0 0 0 2px var(--c-brand)", color: "var(--c-brand-deep-2)" };
    }
    if (isMine && !isCorrectOpt) {
      return { ...base, background: "var(--c-danger-soft-6)", boxShadow: "inset 0 0 0 2px var(--c-danger-b)", color: "var(--c-danger-j)" };
    }
    return { ...base, background: "var(--c-bg-soft-12)", color: "var(--c-text-4c)" };
  }

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text-c)", marginBottom: 16 }}>데일리 퀴즈</h2>
      <div
        style={{
          position: "relative",
          background: "var(--c-bg)",
          borderRadius: 18,
          border: "1px solid var(--c-bg-muted-6)",
          boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
          overflow: "hidden",
        }}
      >
        {/* 상단 헤더 (라벨 + 타이머) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px 0",
            background: "linear-gradient(180deg, var(--c-bg-soft-8) 0%, transparent 100%)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--c-text-5e)", fontWeight: 500, letterSpacing: 0.2 }}>
            오늘의 퀴즈
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--c-text-5e)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {fmtTime(elapsed)}
            </span>
            <button
              type="button"
              aria-label="데일리 과목 변경"
              onClick={openPref}
              className="press"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 28, borderRadius: 999, border: "1px solid var(--c-bg-muted-6)",
                padding: "0 11px 0 8px", background: "var(--c-bg-soft-8)", cursor: "pointer",
                color: "var(--c-text-5e)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/community/machine.svg" alt="" width={16} height={16} style={{ display: "block" }} />
              데일리 과목 변경
            </button>
          </span>
        </div>

        {/* 카테고리 타이틀 */}
        <p style={{ textAlign: "center", margin: "10px 0 0", fontSize: 20, fontWeight: 600, color: "var(--c-text-2f)" }}>
          {q.categoryName} <span style={{ fontWeight: 800, color: "var(--c-text-d)" }}>O/X</span>
        </p>

        {/* 문제 */}
        <p
          style={{
            margin: "22px 0 0",
            padding: "0 20px",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.5,
            color: "var(--c-text-2e)",
            wordBreak: "keep-all",
          }}
        >
          {q.text}
        </p>

        {/* 보기 */}
        {/* 폰은 세로 2줄, 태블릿부터는 예/아니요를 가로로 나란히(globals.css) */}
        <div className="daily-quiz-options" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "26px 16px 16px" }}>
          <button
            type="button"
            className="daily-opt"
            disabled={answered || submitting}
            onClick={() => submit(true)}
            style={optionStyle(true)}
          >
            <span>예</span>
            {answered && correctAnswer === true && <span style={{ fontSize: 13, fontWeight: 700 }}>정답</span>}
          </button>
          <button
            type="button"
            className="daily-opt"
            disabled={answered || submitting}
            onClick={() => submit(false)}
            style={optionStyle(false)}
          >
            <span>아니요</span>
            {answered && correctAnswer === false && <span style={{ fontSize: 13, fontWeight: 700 }}>정답</span>}
          </button>
        </div>

        {/* 응답 후: 결과 + 정답률 */}
        {answered && stats && (
          <div style={{ padding: "0 18px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: myCorrect ? "var(--c-brand-deep-3)" : "var(--c-danger-b)" }}>
                {myCorrect ? "정답이에요!" : "아쉬워요"}
                {myCorrect && xpGained > 0 && (
                  <span style={{ marginLeft: 6, color: "var(--c-warn-e)", fontWeight: 800 }}>경험치 +{xpGained}</span>
                )}
              </span>
              <span style={{ fontSize: 13, color: "var(--c-text-4)", fontWeight: 600 }}>
                정답률 {stats.correctRate}%
                {stats.total > 0 && <span style={{ color: "var(--c-text-5e)" }}> · {stats.total.toLocaleString()}명</span>}
              </span>
            </div>
            {/* 정답률 바 */}
            <div style={{ height: 8, borderRadius: 999, background: "var(--c-bg-muted-7)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${stats.correctRate}%`,
                  background: "linear-gradient(90deg, #7DC4FF, #3787FF)",
                  borderRadius: 999,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            {isGuest && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--c-text-4c)" }}>
                로그인하면 정답 시 경험치가 쌓여요.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 과목 설정 시트 — 고른 과목에서만 오늘의 문제가 나온다(아무것도 안 고르면 전체) */}
      {prefOpen && (
        <div
          onClick={() => !prefSaving && setPrefOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(15,23,42,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520,
              background: "var(--c-bg-elevated)",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--c-text-2)" }}>
              데일리 퀴즈 과목
            </p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--c-text-5)", lineHeight: 1.5 }}>
              고른 과목에서만 오늘의 문제가 나와요. 아무것도 고르지 않으면 전체에서 나옵니다.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "46vh", overflowY: "auto" }}>
              {prefOptions.length === 0 ? (
                <p style={{ fontSize: 14, color: "var(--c-text-5)", textAlign: "center", padding: "16px 0" }}>
                  불러오는 중이에요.
                </p>
              ) : (
                prefOptions.map((opt) => {
                  const on = prefSelected.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setPrefSelected((prev) =>
                          prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]
                        )
                      }
                      className="press"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", minHeight: 52, padding: "0 16px", borderRadius: 14,
                        border: `1.5px solid ${on ? "var(--c-brand)" : "var(--c-border)"}`,
                        background: on ? "var(--c-brand-soft-2)" : "var(--c-bg)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: on ? "var(--c-brand)" : "var(--c-text-2)" }}>
                          {opt.name}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-5)" }}>
                          {opt.count}문항
                        </span>
                      </span>
                      {on && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => savePref([])}
                disabled={prefSaving}
                className="press"
                style={{
                  flex: 1, height: 50, borderRadius: 14, border: "1px solid var(--c-border)",
                  background: "var(--c-bg)", color: "var(--c-text-3)", fontSize: 15, fontWeight: 700,
                  cursor: prefSaving ? "default" : "pointer",
                }}
              >
                전체로
              </button>
              <button
                type="button"
                onClick={() => savePref(prefSelected)}
                disabled={prefSaving}
                className="press"
                style={{
                  flex: 2, height: 50, borderRadius: 14, border: "none",
                  background: "var(--c-brand)", color: "#fff", fontSize: 15, fontWeight: 800,
                  cursor: prefSaving ? "default" : "pointer", opacity: prefSaving ? 0.6 : 1,
                }}
              >
                {prefSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
