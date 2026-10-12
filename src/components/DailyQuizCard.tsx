"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientCache } from "@/lib/clientCache";

const CACHE_KEY = "daily-quiz";

/** 등장 연출은 앱을 연 뒤 **처음 보일 때 한 번만** 재생한다(탭을 오갈 때마다 다시 뛰면 산만하다). */
let dqEntrancePlayed = false;

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
  // 처음 보이는 순간 재생할지(마운트 때 한 번 정한다) — 재방문·캐시 복귀는 조용히 보여 준다.
  const playEntrance = useRef(!dqEntrancePlayed);
  // 카드를 꾹 누르면 과목 변경 시트가 열린다(버튼 대신).
  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const lpFired = useRef(false);
  const [pressing, setPressing] = useState(false);
  // 정답률 숫자 카운트업(0 → 실제 값)
  const [rateShown, setRateShown] = useState(0);

  // ── 과목 설정 ──────────────────────────────────────────────
  // 예전엔 전체 문항에서 뽑아 그날그날 과목이 달라졌다("사문이랑 생윤이 랜덤하게 나온다").
  // 여기서 고른 과목에서만 오늘의 문제가 나온다. 아무것도 고르지 않으면 전체.
  const [prefOpen, setPrefOpen] = useState(false);
  const [prefOptions, setPrefOptions] = useState<{ id: string; name: string; count: number }[]>([]);
  const [prefSelected, setPrefSelected] = useState<string[]>([]);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState(false);

  // 과목 목록·선택값 로드. 카드가 뜰 때 미리 한 번 받아 두고(시트를 열자마자 목록이 보이게),
  // 시트를 열 때 한 번 더 갱신한다. 실패하면 시트 안에 "다시 시도"를 띄운다.
  const loadPref = useCallback(async () => {
    setPrefError(false);
    try {
      const res = await fetch("/api/daily-quiz/preferences", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      const opts = Array.isArray(data?.options) ? data.options : [];
      setPrefOptions(opts);
      setPrefSelected(Array.isArray(data?.selected) ? data.selected : []);
      if (opts.length === 0) setPrefError(true);
    } catch {
      setPrefError(true);
    }
  }, []);

  useEffect(() => {
    loadPref();
  }, [loadPref]);

  useEffect(() => () => {
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
  }, []);

  function openPref() {
    setPrefOpen(true);
    loadPref();
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
  const targetRate = answered ? data?.stats?.correctRate ?? 0 : 0;

  useEffect(() => {
    if (loaded && hasQuestion) dqEntrancePlayed = true;
  }, [loaded, hasQuestion]);

  useEffect(() => {
    if (!targetRate) {
      setRateShown(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setRateShown(Math.round(targetRate * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetRate]);

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

  // 응답 후 각 보기의 상태 클래스.
  function optClass(optValue: boolean): string {
    if (!answered) return "dq-opt";
    if (correctAnswer === optValue) return "dq-opt is-correct";
    if (mySelected === optValue) return "dq-opt is-wrong";
    return "dq-opt is-dim";
  }

  // ── 꾹 누르기 ──
  const LONG_PRESS_MS = 550;
  function lpCancel() {
    if (lpTimer.current) {
      window.clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
    setPressing(false);
  }
  function lpDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    lpTimer.current = window.setTimeout(() => {
      lpTimer.current = null;
      lpFired.current = true;
      setPressing(false);
      try { navigator.vibrate?.(12); } catch { /* 진동 미지원 */ }
      openPref();
    }, LONG_PRESS_MS);
  }
  function lpMove(e: React.PointerEvent) {
    const st = lpStart.current;
    if (!st || !lpTimer.current) return;
    // 스크롤하려는 손가락이면 취소
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) lpCancel();
  }
  // 꾹 눌러 시트가 열린 뒤 손을 뗄 때 보기 버튼이 눌린 것으로 처리되지 않게 막는다.
  function lpClickGuard(e: React.MouseEvent) {
    if (lpFired.current) {
      e.preventDefault();
      e.stopPropagation();
      lpFired.current = false;
    }
  }

  const stagger = (i: number) => ({ ["--i" as string]: i } as React.CSSProperties);

  return (
    <section className={playEntrance.current ? "dq-anim" : undefined} aria-label="데일리 퀴즈">
      <div
        className={`dq-card${pressing ? " is-pressing" : ""}`}
        onPointerDown={lpDown}
        onPointerMove={lpMove}
        onPointerUp={lpCancel}
        onPointerCancel={lpCancel}
        onPointerLeave={lpCancel}
        onClickCapture={lpClickGuard}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* ① 문제 — 카드 없이 배경 위에 그대로 */}
        <div className="dq-qcard dq-in" style={stagger(0)}>

        {/* 카테고리 타이틀 */}
        <p className="dq-cat">
          {q.categoryName}
        </p>

        {/* 문제 */}
        <p className="dq-q">{q.text}</p>
        </div>

        {/* ② 보기 — 카드 둘 — 폰은 세로 2줄, 태블릿부터는 예/아니요를 가로로 나란히(globals.css) */}
        <div className="daily-quiz-options dq-opts">
          <button
            type="button"
            className={`daily-opt ${optClass(true)} dq-in`}
            style={stagger(1)}
            disabled={answered || submitting}
            onClick={() => submit(true)}
          >
            <span className="dq-badge dq-badge-o" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <circle cx="17" cy="17" r="17" fill="url(#dqO)" />
                <circle cx="17" cy="17" r="7" stroke="#fff" strokeWidth="3.6" />
                <ellipse cx="11.5" cy="8.5" rx="6" ry="3.2" fill="#fff" opacity=".28" transform="rotate(-28 11.5 8.5)" />
                <defs>
                  <linearGradient id="dqO" x1="6" y1="2" x2="28" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7DB8FF" /><stop offset="1" stopColor="#2F7BFF" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="dq-opt-t">예</span>
            {answered && correctAnswer === true && <span className="dq-opt-tag">정답</span>}
            {answered && mySelected === true && correctAnswer !== true && <span className="dq-opt-tag">내 선택</span>}
          </button>
          <button
            type="button"
            className={`daily-opt ${optClass(false)} dq-in`}
            style={stagger(2)}
            disabled={answered || submitting}
            onClick={() => submit(false)}
          >
            <span className="dq-badge dq-badge-x" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <circle cx="17" cy="17" r="17" fill="url(#dqX)" />
                <path d="M11.5 11.5l11 11M22.5 11.5l-11 11" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
                <ellipse cx="11.5" cy="8.5" rx="6" ry="3.2" fill="#fff" opacity=".28" transform="rotate(-28 11.5 8.5)" />
                <defs>
                  <linearGradient id="dqX" x1="6" y1="2" x2="28" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FF9C9C" /><stop offset="1" stopColor="#EE4A4A" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="dq-opt-t">아니요</span>
            {answered && correctAnswer === false && <span className="dq-opt-tag">정답</span>}
            {answered && mySelected === false && correctAnswer !== false && <span className="dq-opt-tag">내 선택</span>}
          </button>
        </div>

      {/* ③ 안내 + 타이머 — 보기(아니요) 바로 아래 */}
      <div className="dq-head dq-in" style={stagger(3)}>
        <span className="dq-hint">꾹 눌러 과목 변경</span>
        <span className="dq-head-r">
          <span className="dq-time">{fmtTime(elapsed)}</span>
        </span>
      </div>

        {/* 응답 후: 결과 + 정답률 */}
        {answered && stats && (
          <div className="dq-rcard dq-in" style={stagger(4)}>
            <div className="dq-result-row">
              <span className={`dq-verdict ${myCorrect ? "is-ok" : "is-no"}`}>
                {myCorrect ? "정답이에요!" : "아쉬워요"}
                {myCorrect && xpGained > 0 && <span className="dq-xp">경험치 +{xpGained}</span>}
              </span>
              <span className="dq-rate">
                정답률 <b>{rateShown}%</b>
                {stats.total > 0 && <span className="dq-rate-n"> · {stats.total.toLocaleString()}명</span>}
              </span>
            </div>
            {/* 정답률 바 — 왼쪽에서 차오른다 */}
            <div className="dq-track">
              <div className="dq-fill" style={{ width: `${stats.correctRate}%` }} />
            </div>
            {isGuest && <p className="dq-guest">로그인하면 정답 시 경험치가 쌓여요.</p>}
          </div>
        )}
      </div>

      {/* 과목 설정 시트 — 고른 과목에서만 오늘의 문제가 나온다(아무것도 안 고르면 전체)
          반드시 document.body 포털로 띄운다. 카드(overflow:hidden) 안에서 fixed 로 두면 조상에
          transform/animation 이 하나라도 있는 순간 fixed 가 그 조상 기준이 되어 시트가 카드 안에
          갇힌다 — 갤럭시(안드로이드 WebView)에서 "과목 목록이 안 뜨고 안 바뀐다"던 원인. */}
      {prefOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => !prefSaving && setPrefOpen(false)}
          style={{
            // 구형 안드로이드 웹뷰는 inset 단축을 모른다 — 오버레이가 화면을 못 덮어
            // 과목 목록이 가려지고 스크롤도 먹지 않았다(NoticePopup 과 같은 규칙).
            position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 400,
            background: "rgba(15,23,42,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              // 높이에 vh 를 쓰지 않는다. 안드로이드 WebView 는 vh 가 0/엉뚱한 값으로 잡히는 일이 있어
              // (웹뷰 높이 측정 문제) 목록만 높이 0 으로 사라지고 제목·버튼만 남았다.
              // 오버레이(top/bottom:0)의 % 와 플렉스 컬럼으로만 높이를 정한다.
              width: "100%", maxWidth: 520, maxHeight: "88%", boxSizing: "border-box",
              display: "flex", flexDirection: "column",
              background: "var(--c-bg-elevated, var(--c-bg))",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--c-text-2)" }}>
              데일리 퀴즈 과목
            </p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--c-text-5)", lineHeight: 1.5 }}>
              원하는 과목을 눌러 고른 뒤 <b>저장</b>을 눌러주세요. 여러 개 고를 수 있어요.
            </p>

            <div
              style={{
                display: "flex", flexDirection: "column", gap: 8,
                flex: "1 1 auto", minHeight: 0, overflowY: "auto",
                WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
              }}
            >
              {prefOptions.length === 0 ? (
                prefError ? (
                  <div style={{ textAlign: "center", padding: "14px 0" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--c-text-5)" }}>과목 목록을 불러오지 못했어요.</p>
                    <button type="button" onClick={loadPref} className="press" style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-bg)", color: "var(--c-text-2)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>다시 시도</button>
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--c-text-5)", textAlign: "center", padding: "16px 0" }}>
                    불러오는 중이에요.
                  </p>
                )
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

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexShrink: 0 }}>
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
                전체 과목
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
        </div>,
        document.body
      )}

      <style>{`
        /* 오늘의 퀴즈 — 홈 카드(OX·단어·모의고사)와 같은 결: 옅은 푸른 흰 유리 + 빛 번짐.
           색은 이 카드 전용 토큰으로 두고 다크에서 갈아끼운다. */
        .dq-card {
          --dq-bg1: #FFFFFF; --dq-bg2: #F3F8FF;
          --dq-bd: rgba(40, 84, 170, 0.11);
          --dq-sh: 0 14px 34px -12px rgba(40, 84, 170, 0.22), 0 2px 6px rgba(40, 84, 170, 0.05);
          --dq-ink: #17233A; --dq-sub: rgba(23, 35, 58, 0.58);
          --dq-accent: #2A6FE0;
            --dq-pill-bg: rgba(23, 35, 58, 0.05);
          --dq-opt-bg: rgba(255, 255, 255, 0.82); --dq-opt-bd: rgba(40, 84, 170, 0.14);
          --dq-opt-sh: 0 8px 18px -10px rgba(40, 84, 170, 0.32);
          --dq-ok: #12936A; --dq-ok-bg: rgba(31, 190, 140, 0.13); --dq-ok-bd: rgba(31, 190, 140, 0.55);
          --dq-no: #D13C3C; --dq-no-bg: rgba(240, 80, 80, 0.10); --dq-no-bd: rgba(240, 80, 80, 0.5);
          --dq-track: rgba(23, 35, 58, 0.08);
          --dq-gold: #A9780D; --dq-gold-bg: rgba(255, 196, 80, 0.2);
        }
        /* 예전엔 문제·보기·결과가 한 카드에 묶여 있었다. 지금은 문제는 카드 없이 글만, 보기 둘과 결과만 각자 카드. */
        .dq-qcard { padding: 2px 4px 6px; }
        [data-theme="dark"] .dq-card {
          --dq-bg1: #1D2030; --dq-bg2: #171A26;
          --dq-bd: rgba(255, 255, 255, 0.09);
          --dq-sh: 0 14px 34px -12px rgba(0, 0, 0, 0.6);
          --dq-ink: #EEF1F8; --dq-sub: rgba(255, 255, 255, 0.58);
          --dq-accent: #8FC0FF;
            --dq-pill-bg: rgba(255, 255, 255, 0.08);
          --dq-opt-bg: rgba(255, 255, 255, 0.06); --dq-opt-bd: rgba(255, 255, 255, 0.12);
          --dq-opt-sh: 0 8px 18px -10px rgba(0, 0, 0, 0.6);
          --dq-ok: #5BE0B4; --dq-ok-bg: rgba(60, 214, 160, 0.16); --dq-ok-bd: rgba(80, 224, 176, 0.55);
          --dq-no: #FF8B8B; --dq-no-bg: rgba(255, 100, 100, 0.14); --dq-no-bd: rgba(255, 120, 120, 0.5);
          --dq-track: rgba(255, 255, 255, 0.12);
          --dq-gold: #F5CF72; --dq-gold-bg: rgba(255, 200, 90, 0.16);
        }

        .dq-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 4px 0; }
        .dq-head-r { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
        .dq-time {
          padding: 4px 9px; border-radius: 999px; background: var(--dq-pill-bg);
          font-size: 12px; font-weight: 700; color: var(--dq-sub); font-variant-numeric: tabular-nums; white-space: nowrap;
        }

        .dq-hint { font-size: 12px; font-weight: 600; color: var(--dq-sub); opacity: 0.8; white-space: nowrap; }
        /* 꾹 누르는 동안 카드가 천천히 가라앉고 빛이 모인다 — 놓으면 빠르게 돌아온다 */
        .dq-card { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
        .dq-card.is-pressing { transform: scale(0.982); transition: transform 0.55s cubic-bezier(0.3, 0, 0.5, 1); }
        .dq-cat { margin: 14px 0 0; text-align: left; font-size: 15px; font-weight: 700; color: var(--dq-sub); letter-spacing: -0.2px; }
        .dq-q { margin: 8px 0 0; padding: 0; font-size: 21px; font-weight: 800; line-height: 1.5; letter-spacing: -0.4px; color: var(--dq-ink); word-break: keep-all; }

        .dq-opts { display: flex; flex-direction: column; gap: 10px; padding: 18px 0 0; }
        .dq-opt {
          position: relative; display: flex; align-items: center; gap: 12px; width: 100%; height: 60px; padding: 0 16px 0 12px;
          border-radius: 18px; border: 1px solid var(--dq-opt-bd); background: var(--dq-opt-bg); box-shadow: var(--dq-opt-sh);
          color: var(--dq-ink); font-size: 17px; font-weight: 800; text-align: left; letter-spacing: -0.2px;
        }
        .dq-opt:disabled { cursor: default; }
        .dq-badge { display: block; width: 34px; height: 34px; flex-shrink: 0; filter: drop-shadow(0 4px 6px rgba(30, 60, 140, 0.28)); transition: transform 0.35s cubic-bezier(0.22, 1.5, 0.36, 1); }
        .dq-badge svg { display: block; }
        .dq-badge-x { filter: drop-shadow(0 4px 6px rgba(200, 40, 40, 0.28)); }
        .dq-opt:active:not(:disabled) .dq-badge { transform: scale(0.88) rotate(-6deg); }
        .dq-opt-tag {
          margin-left: auto; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap;
          color: var(--dq-ok); background: var(--dq-ok-bg);
        }
        .dq-opt.is-correct { border-color: var(--dq-ok-bd); background: var(--dq-ok-bg); color: var(--dq-ok); box-shadow: 0 0 0 3px var(--dq-ok-bg), var(--dq-opt-sh); animation: dqCorrect 0.55s cubic-bezier(0.22, 1.5, 0.36, 1) both; }
        .dq-opt.is-correct .dq-badge { animation: dqBadgePop 0.6s cubic-bezier(0.22, 1.7, 0.36, 1) both; }
        .dq-opt.is-wrong { border-color: var(--dq-no-bd); background: var(--dq-no-bg); color: var(--dq-no); animation: dqShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        .dq-opt.is-wrong .dq-opt-tag { color: var(--dq-no); background: var(--dq-no-bg); }
        .dq-opt.is-dim { opacity: 0.5; box-shadow: none; }

        .dq-rcard {
          margin-top: 12px; padding: 16px 18px 18px; border-radius: 22px;
          background: var(--dq-opt-bg); border: 1px solid var(--dq-opt-bd); box-shadow: var(--dq-opt-sh);
        }
        .dq-result-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; animation: dqUp 0.45s ease-out both; }
        .dq-verdict { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; font-weight: 800; }
        .dq-verdict.is-ok { color: var(--dq-ok); }
        .dq-verdict.is-no { color: var(--dq-no); }
        .dq-xp { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 800; color: var(--dq-gold); background: var(--dq-gold-bg); animation: dqXp 0.7s cubic-bezier(0.22, 1.6, 0.36, 1) 0.25s both; }
        .dq-rate { font-size: 13px; font-weight: 600; color: var(--dq-sub); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .dq-rate b { font-size: 15px; font-weight: 800; color: var(--dq-ink); }
        .dq-rate-n { opacity: 0.8; }
        .dq-track { height: 8px; border-radius: 999px; background: var(--dq-track); overflow: hidden; }
        .dq-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7DC4FF, #3787FF 55%, #7A5CFF); transform-origin: left center; animation: dqBar 0.95s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .dq-guest { margin: 10px 0 0; font-size: 12px; color: var(--dq-sub); }

        /* 처음 보일 때 — 카드가 떠오르고, 안의 것들이 차례로 들어온다(앱을 연 뒤 한 번만) */
        .dq-anim .dq-card { animation: dqCardIn 0.75s cubic-bezier(0.2, 1.15, 0.3, 1) backwards; }
        .dq-anim .dq-in:not(.is-correct):not(.is-wrong):not(.is-dim) { animation: dqUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(0.18s + var(--i, 0) * 0.08s); }
        .dq-anim .dq-opt.dq-in:not(.is-correct):not(.is-wrong):not(.is-dim) { animation-name: dqOptIn; }
        .dq-anim .dq-opt:not(.is-correct) .dq-badge { animation: dqBadgeIn 0.6s cubic-bezier(0.22, 1.7, 0.36, 1) both; animation-delay: calc(0.4s + var(--i, 0) * 0.08s); }

        @keyframes dqCardIn { from { opacity: 0; transform: translateY(30px) scale(0.955); } to { opacity: 1; transform: none; } }
        @keyframes dqUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes dqOptIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes dqBadgeIn { from { opacity: 0; transform: scale(0.3) rotate(-30deg); } to { opacity: 1; transform: none; } }
        @keyframes dqBadgePop { 0% { transform: scale(1); } 45% { transform: scale(1.28) rotate(-8deg); } 100% { transform: scale(1); } }
        @keyframes dqCorrect { 0% { transform: scale(0.97); } 60% { transform: scale(1.025); } 100% { transform: scale(1); } }
        @keyframes dqShake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(3px); } 30%, 50%, 70% { transform: translateX(-5px); } 40%, 60% { transform: translateX(5px); } }
        @keyframes dqBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes dqXp { from { opacity: 0; transform: translateY(6px) scale(0.6); } to { opacity: 1; transform: none; } }
        @keyframes dqGlow { 0%, 100% { opacity: 0.75; transform: translate(0, 0) scale(1); } 50% { opacity: 1; transform: translate(-8px, 6px) scale(1.12); } }
        @media (prefers-reduced-motion: reduce) {
          .dq-card, .dq-in, .dq-opt, .dq-badge, .dq-fill, .dq-xp, .dq-result-row { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
