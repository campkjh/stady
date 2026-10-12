"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientCache } from "@/lib/clientCache";
import { TossBubbleGlass } from "@/components/TossBubble";

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

/** 답한 직후 네비게이션 위로 올라오는 결과 토스트(섹션 안에 끼워 넣지 않는다). */
interface ResultToastData {
  correct: boolean;
  xp: number;
  guest: boolean;
  rate: number;
  total: number;
  /** 정답을 맞힌 사람 수 */
  correctCount: number;
}

/**
 * 결과 토스트 — 홈 "새로운 문제집" 말풍선(프리티풀 퀴크매칭 말풍선 이식, globals .qm-bubble*)과 같은 유리 말풍선.
 *  · 바탕은 꼬리+몸통 한 장의 유리(TossBubbleGlass) + 뒤 흐림. 등장은 꼬리 쪽에서 납작하게 솟아 제 크기로(qmBubblePopDown).
 *  · 안에서는 아이콘이 튀고(맞히면 반짝이 터짐), 정답률 숫자가 올라가고, 바가 왼쪽에서 차오른다.
 *  · 누르면 접히고, 4.6초 뒤 저절로 접힌다. 하단 네비 바로 위에 뜬다.
 */
function ResultToast({ data, onClose }: { data: ResultToastData; onClose: () => void }) {
  // 네비 높이(안전영역 포함)를 재서 그 위 12px 에 둔다.
  const [bottom, setBottom] = useState(96);
  const [leaving, setLeaving] = useState(false);
  const [rate, setRate] = useState(0);
  const [width, setWidth] = useState<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>(".main-nav");
    setBottom((nav ? nav.getBoundingClientRect().height : 0) + 12);
    const el = bubbleRef.current;
    if (!el) return;
    const measure = () => setWidth((prev) => (prev === el.offsetWidth ? prev : el.offsetWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 4600);
    const t2 = window.setTimeout(() => closeRef.current(), 4800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // 정답률 숫자 카운트업(말풍선이 다 솟은 뒤 시작)
  useEffect(() => {
    if (!data.rate) return;
    let raf = 0;
    const start = performance.now() + 380;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / 900));
      setRate(Math.round(data.rate * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data.rate]);

  function dismiss() {
    setLeaving(true);
    window.setTimeout(() => closeRef.current(), 200);
  }

  if (typeof document === "undefined") return null;
  const tailX = Math.round((width ?? 300) / 2);
  const ok = data.correct;
  return createPortal(
    <div className="dqt" style={{ bottom }}>
      <div
        ref={bubbleRef}
        className={`qm-bubble is-tail-down is-fit dqt-bubble${leaving ? " is-out" : ""}`}
        style={{ ["--tail-x" as string]: `${tailX}px` } as React.CSSProperties}
        role="status"
        aria-live="polite"
        onClick={dismiss}
      >
        <span className="qm-bubble-shadow" aria-hidden="true" />
        <TossBubbleGlass tailX={tailX} side="bottom" />
        <div className="qm-bubble-body">
          <span className="qm-bubble-ic" aria-hidden="true">
            <span className={`dqt-medal ${ok ? "is-ok" : "is-no"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ok ? "/images/ox/disc-o-sm.webp" : "/images/ox/disc-x-sm.webp"} alt="" width={38} height={38} />
            </span>
            {ok && (
              <span className="dqt-burst">
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} style={{ ["--a" as string]: `${i * 45}deg`, ["--c" as string]: i % 2 ? "#FFC53D" : "#5BA3FF" } as React.CSSProperties} />
                ))}
              </span>
            )}
          </span>
          <div className="dqt-line">
            <p className={`qm-bubble-title dqt-title ${ok ? "is-ok" : "is-no"}`}>{ok ? "정답이에요!" : "아쉬워요"}</p>
            {ok && data.xp > 0 && <span className="dqt-xp">경험치 +{data.xp}</span>}
          </div>
          <p className="qm-bubble-sub dqt-sub">
            정답률 <b>{rate}%</b>
            {data.total > 0 && <span> · {data.correctCount.toLocaleString()}명이 맞혔어요</span>}
          </p>
          {data.guest && <p className="dqt-guest">로그인하면 정답 시 경험치가 쌓여요.</p>}
        </div>
      </div>
      <style>{`
        .dqt { position: fixed; left: 0; right: 0; z-index: 60; display: flex; justify-content: center; padding: 0 14px; pointer-events: none; }
        /* 말풍선 기본(.qm-bubble)은 absolute — 여기선 가운데 칸 안에서 제 폭으로 */
        .qm-bubble.dqt-bubble { position: relative; width: 100%; max-width: 440px; pointer-events: auto; }
        .qm-bubble.dqt-bubble .qm-bubble-body { padding: 13px 20px 12px 60px; }
        .dqt-line { display: flex; align-items: center; gap: 8px; min-width: 0; animation: qmBubbleContent 1s linear both; }
        /* 제목 색 — 맞히면 파랑, 틀리면 빨강(말풍선 제목과 같은 그라데이션 글씨) */
        .qm-bubble-title.dqt-title { animation: none; }
        .qm-bubble-title.dqt-title.is-ok { background-image: linear-gradient(90deg, #2F7BFF 0%, #2A5BD0 55%, #1E3F9C 100%); }
        .qm-bubble-title.dqt-title.is-no { background-image: linear-gradient(90deg, #F25C5C 0%, #D13C3C 55%, #A93030 100%); }
        [data-theme="dark"] .qm-bubble-title.dqt-title.is-ok { background-image: linear-gradient(90deg, #8FC0FF 0%, #B7D6FF 55%, #E7EEFB 100%); }
        [data-theme="dark"] .qm-bubble-title.dqt-title.is-no { background-image: linear-gradient(90deg, #FF9A9A 0%, #FFB6B6 55%, #FFE3E3 100%); }
        .dqt-xp { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #A9780D; background: rgba(255, 196, 80, 0.24); white-space: nowrap; animation: dqtPop 0.7s cubic-bezier(0.22, 1.6, 0.36, 1) 0.55s both; }
        [data-theme="dark"] .dqt-xp { color: #F5CF72; background: rgba(255, 200, 90, 0.18); }
        .dqt-sub { font-variant-numeric: tabular-nums; }
        .dqt-sub b { font-weight: 700; color: #191F28; }
        [data-theme="dark"] .dqt-sub b { color: #E7EAF0; }
        .dqt-guest { margin: 8px 0 0; font-size: 12px; color: #8B95A1; animation: qmBubbleContent 1s linear both; }
        /* 아이콘 메달 */
        .qm-bubble.dqt-bubble .qm-bubble-ic { left: 11px; width: 38px; height: 38px; margin-top: -21px; }
        .dqt-medal { position: relative; display: block; width: 38px; height: 38px; animation: dqtMedal 0.7s cubic-bezier(0.22, 1.7, 0.36, 1) 0.28s both; filter: drop-shadow(0 6px 8px rgba(30, 70, 160, 0.3)); }
        .dqt-medal.is-no { filter: drop-shadow(0 6px 8px rgba(200, 40, 40, 0.3)); animation-name: dqtMedalNo; animation-duration: 0.6s; }
        .dqt-medal img { display: block; width: 100%; height: 100%; }
        .dqt-medal.is-ok::after { content: ""; position: absolute; inset: -1px; border-radius: 50%; border: 2px solid rgba(47, 123, 255, 0.55); animation: dqtRing 1s ease-out 0.5s both; }
        /* 맞히면 반짝이가 사방으로 터진다 */
        .dqt-burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
        .dqt-burst i { position: absolute; left: -2.5px; top: -2.5px; width: 5px; height: 5px; border-radius: 50%; background: var(--c); opacity: 0; animation: dqtBurst 0.85s cubic-bezier(0.2, 0.8, 0.3, 1) 0.45s both; }
        @keyframes dqtMedalNo { 0% { opacity: 0; transform: scale(0.4) rotate(-30deg); } 55% { opacity: 1; transform: scale(1.12) rotate(8deg); } 70% { transform: translateX(-3px); } 85% { transform: translateX(3px); } 100% { opacity: 1; transform: none; } }
        @keyframes dqtMedal { from { opacity: 0; transform: scale(0.3) rotate(-40deg); } to { opacity: 1; transform: none; } }
        @keyframes dqtRing { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.7); } }
        @keyframes dqtBurst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(-8px) scale(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-30px) scale(0.3); } }
        @keyframes dqtPop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .dqt-medal, .dqt-medal::after, .dqt-burst i, .dqt-xp { animation: none !important; } .dqt-burst { display: none; } }
      `}</style>
    </div>,
    document.body
  );
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
  const [toast, setToast] = useState<ResultToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 처음 보이는 순간 재생할지(마운트 때 한 번 정한다) — 재방문·캐시 복귀는 조용히 보여 준다.
  const playEntrance = useRef(!dqEntrancePlayed);
  // 카드를 꾹 누르면 과목 변경 시트가 열린다(버튼 대신).
  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const lpFired = useRef(false);
  const [pressing, setPressing] = useState(false);

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

  useEffect(() => {
    if (loaded && hasQuestion) dqEntrancePlayed = true;
  }, [loaded, hasQuestion]);

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
        setToast({
          correct: !!r.isCorrect,
          xp: r.xpGained ?? 0,
          guest: !!r.guest,
          rate: r.stats?.correctRate ?? 0,
          total: r.stats?.total ?? 0,
          correctCount: r.stats?.correct ?? 0,
        });
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
      </div>

      {toast && <ResultToast data={toast} onClose={() => setToast(null)} />}

      {/* 과목 설정 시트 — 고른 과목에서만 오늘의 문제가 나온다(아무것도 안 고르면 전체)
          반드시 document.body 포털로 띄운다. 카드(overflow:hidden) 안에서 fixed 로 두면 조상에
          transform/animation 이 하나라도 있는 순간 fixed 가 그 조상 기준이 되어 시트가 카드 안에
          갇힌다 — 갤럭시(안드로이드 WebView)에서 "과목 목록이 안 뜨고 안 바뀐다"던 원인. */}
      {prefOpen && typeof document !== "undefined" && createPortal(
        <div className="mdl-root is-sheet" style={{ zIndex: 400 }}>
          <div className="mdl-dim" onClick={() => !prefSaving && setPrefOpen(false)} />
          {/* 높이에 vh 를 쓰지 않는다 — 안드로이드 WebView 는 vh 가 0/엉뚱한 값으로 잡혀 목록만 사라진 적이 있다.
              오버레이(top/bottom:0)의 % 와 플렉스 컬럼으로만 높이를 정한다(.mdl-sheet 가 그렇게 짜여 있다). */}
          <div className="mdl-sheet" style={{ maxWidth: 520 }}>
            <div className="mdl-handle" />
            <div className="mdl-text" style={{ paddingBottom: 16 }}>
              <h2 className="mdl-title">데일리 퀴즈 과목</h2>
              <p className="mdl-body is-sm">원하는 과목을 눌러 고른 뒤 <b>저장</b>을 눌러주세요. 여러 개 고를 수 있어요.</p>
            </div>

            <div className="mdl-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px", flex: "1 1 auto" }}>
              {prefOptions.length === 0 ? (
                prefError ? (
                  <div style={{ textAlign: "center", padding: "14px 0" }}>
                    <p className="mdl-body is-sm" style={{ margin: "0 0 12px" }}>과목 목록을 불러오지 못했어요.</p>
                    <button type="button" onClick={loadPref} className="mdl-btn is-sub" style={{ flex: "none", padding: "0 22px" }}>다시 시도</button>
                  </div>
                ) : (
                  <p className="mdl-body is-sm" style={{ textAlign: "center", padding: "16px 0" }}>불러오는 중이에요.</p>
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
                        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
                        width: "100%", minHeight: 56, padding: "0 18px", borderRadius: 17, border: "none",
                        background: on ? "rgba(49,130,246,0.12)" : "var(--mdl-field)",
                        boxShadow: on ? "inset 0 0 0 2px rgba(49,130,246,0.6)" : "none",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: on ? "var(--mdl-accent)" : "var(--mdl-title)" }}>
                          {opt.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mdl-sub)" }}>{opt.count}문항</span>
                      </span>
                      {on && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mdl-accent)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mdl-actions is-tight" style={{ flexShrink: 0 }}>
              <button type="button" onClick={() => savePref([])} disabled={prefSaving} className="mdl-btn is-sub" style={{ flex: 1 }}>
                전체 과목
              </button>
              <button type="button" onClick={() => savePref(prefSelected)} disabled={prefSaving} className="mdl-btn is-main" style={{ flex: 2 }}>
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
          --dq-ok: #2A6FE0; --dq-ok-bg: rgba(55, 135, 255, 0.12); --dq-ok-bd: rgba(55, 135, 255, 0.55);
          --dq-no: #D13C3C; --dq-no-bg: rgba(240, 80, 80, 0.10); --dq-no-bd: rgba(240, 80, 80, 0.5);
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
          --dq-ok: #8FC0FF; --dq-ok-bg: rgba(90, 150, 255, 0.18); --dq-ok-bd: rgba(120, 170, 255, 0.6);
          --dq-no: #FF8B8B; --dq-no-bg: rgba(255, 100, 100, 0.14); --dq-no-bd: rgba(255, 120, 120, 0.5);
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
        .dq-q { margin: 8px 0 0; padding: 0; font-size: 21px; font-weight: 700; line-height: 1.5; letter-spacing: -0.4px; color: var(--dq-ink); word-break: keep-all; }

        .dq-opts { display: flex; flex-direction: column; gap: 10px; padding: 18px 0 0; }
        .dq-opt {
          position: relative; display: flex; align-items: center; gap: 12px; width: 100%; height: 60px; padding: 0 16px 0 12px;
          border-radius: 18px; border: 1px solid var(--dq-opt-bd); background: var(--dq-opt-bg); box-shadow: var(--dq-opt-sh);
          color: var(--dq-ink); font-size: 17px; font-weight: 700; text-align: left; letter-spacing: -0.2px;
        }
        .dq-opt:disabled { cursor: default; }
        .dq-badge { display: block; width: 34px; height: 34px; flex-shrink: 0; filter: drop-shadow(0 4px 6px rgba(30, 60, 140, 0.28)); transition: transform 0.35s cubic-bezier(0.22, 1.5, 0.36, 1); }
        .dq-badge svg { display: block; }
        .dq-badge-x { filter: drop-shadow(0 4px 6px rgba(200, 40, 40, 0.28)); }
        .dq-opt:active:not(:disabled) .dq-badge { transform: scale(0.88) rotate(-6deg); }
        .dq-opt-tag {
          margin-left: auto; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap;
          color: var(--dq-ok); background: var(--dq-ok-bg);
        }
        .dq-opt.is-correct { border-color: var(--dq-ok-bd); background: var(--dq-ok-bg); color: var(--dq-ok); box-shadow: 0 0 0 3px var(--dq-ok-bg), var(--dq-opt-sh); animation: dqCorrect 0.55s cubic-bezier(0.22, 1.5, 0.36, 1) both; }
        .dq-opt.is-correct .dq-badge { animation: dqBadgePop 0.6s cubic-bezier(0.22, 1.7, 0.36, 1) both; }
        .dq-opt.is-wrong { border-color: var(--dq-no-bd); background: var(--dq-no-bg); color: var(--dq-no); animation: dqShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        .dq-opt.is-wrong .dq-opt-tag { color: var(--dq-no); background: var(--dq-no-bg); }
        .dq-opt.is-dim { opacity: 0.5; box-shadow: none; }


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
        @keyframes dqGlow { 0%, 100% { opacity: 0.75; transform: translate(0, 0) scale(1); } 50% { opacity: 1; transform: translate(-8px, 6px) scale(1.12); } }
        @media (prefers-reduced-motion: reduce) {
          .dq-card, .dq-in, .dq-opt, .dq-badge { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
