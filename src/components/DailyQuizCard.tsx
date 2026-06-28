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
      color: "#2E333B",
      background: "#EBEFF4",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: answered ? "default" : "pointer",
    };
    if (!answered) return base;
    const isCorrectOpt = correctAnswer === optValue;
    const isMine = mySelected === optValue;
    if (isCorrectOpt) {
      return { ...base, background: "#E8F0FE", boxShadow: "inset 0 0 0 2px #3787FF", color: "#1D4ED8" };
    }
    if (isMine && !isCorrectOpt) {
      return { ...base, background: "#FFE7E7", boxShadow: "inset 0 0 0 2px #E85D5D", color: "#C0392B" };
    }
    return { ...base, background: "#F4F6F9", color: "#9CA3AF" };
  }

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>데일리 퀴즈</h2>
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #EEF0F3",
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
            background: "linear-gradient(180deg, #F7F8FA 0%, rgba(247,248,250,0) 100%)",
          }}
        >
          <span style={{ fontSize: 13, color: "#B6BCC6", fontWeight: 500, letterSpacing: 0.2 }}>
            오늘의 퀴즈
          </span>
          <span style={{ fontSize: 14, color: "#B6BCC6", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(elapsed)}
          </span>
        </div>

        {/* 카테고리 타이틀 */}
        <p style={{ textAlign: "center", margin: "10px 0 0", fontSize: 20, fontWeight: 600, color: "#3A3F47" }}>
          {q.categoryName} <span style={{ fontWeight: 800, color: "#1B1E24" }}>O/X</span>
        </p>

        {/* 문제 */}
        <p
          style={{
            margin: "22px 0 0",
            padding: "0 20px",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.5,
            color: "#2E333B",
            wordBreak: "keep-all",
          }}
        >
          {q.text}
        </p>

        {/* 보기 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "26px 16px 16px" }}>
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
              <span style={{ fontSize: 14, fontWeight: 800, color: myCorrect ? "#2563EB" : "#E85D5D" }}>
                {myCorrect ? "정답이에요!" : "아쉬워요"}
                {myCorrect && xpGained > 0 && (
                  <span style={{ marginLeft: 6, color: "#E59500", fontWeight: 800 }}>경험치 +{xpGained}</span>
                )}
              </span>
              <span style={{ fontSize: 13, color: "#8A909C", fontWeight: 600 }}>
                정답률 {stats.correctRate}%
                {stats.total > 0 && <span style={{ color: "#B6BCC6" }}> · {stats.total.toLocaleString()}명</span>}
              </span>
            </div>
            {/* 정답률 바 */}
            <div style={{ height: 8, borderRadius: 999, background: "#EEF1F5", overflow: "hidden" }}>
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
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                로그인하면 정답 시 경험치가 쌓여요.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
