"use client";

import { useEffect, useState } from "react";

// 퀴즈 경과 시간. 자체 틱으로 이 부분만 리렌더되므로 문제 화면 전체가 초당 리렌더되지 않는다.
// 벽시계(startAt) 기준이라 앱을 백그라운드로 보냈다 와도 정확하다.
function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function QuizTimer({ startAt, paused = false }: { startAt: number; paused?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (paused) return;
    const calc = () => setElapsed(Math.max(0, Math.floor((Date.now() - startAt) / 1000)));
    const t0 = setTimeout(calc, 0); // 동기 setState 금지(React Compiler)
    const t = setInterval(calc, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [startAt, paused]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 11px 0 9px",
        borderRadius: 999,
        background: "#F3F5F8",
        color: "#2B313D",
        fontSize: 13.5,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.2px",
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 1.5" />
        <path d="M9 2h6" />
      </svg>
      {fmt(elapsed)}
    </span>
  );
}
