"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export interface StudyCheck {
  id: string;
  question: string;
  dueAt: string;
}

// 공부 중 확인 퀴즈 팝업. 타이머가 돌아가는 동안 랜덤한 시점에 뜬다.
// 답하지 않고 3시간이 지나면 서버가 타이머를 끈다(자리 비움 방지).
//
// WebView 규칙: document.body 포털 / inset 단축 금지(top·right·bottom·left) /
// 등장 애니메이션 없음 — NoticePopup 과 같다.
export default function StudyCheckPopup({
  check,
  onDone,
}: {
  check: StudyCheck;
  onDone: (result: "answered" | "expired") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; answer?: boolean; explanation?: string | null } | null>(null);
  // 카운트다운 대신 "언제까지" 를 보여준다 — props 만 쓰는 순수 계산이라
  // 렌더 중 Date.now() 를 읽거나 이펙트에서 setState 를 부를 일이 없다.
  const deadline = new Date(check.dueAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

  async function answer(selected: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/timer/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checkId: check.id, selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.expired) { onDone("expired"); return; }
      setResult({ correct: !!data?.correct, answer: data?.answer, explanation: data?.explanation ?? null });
    } catch {
      setBusy(false);
    }
  }

  const overlay = (
    <div
      data-gate="study-check"
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2600,
        background: "rgba(15,23,42,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 360, background: "var(--c-bg-elevated, var(--c-bg))",
          borderRadius: 20, padding: "22px 20px 18px", boxSizing: "border-box",
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/flame/f4.svg" alt="" width={18} height={18} style={{ display: "block" }} />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--c-brand-b)" }}>공부 중 확인</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--c-text-5)" }}>{deadline}까지</span>
        </div>

        {result ? (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 900, color: result.correct ? "var(--c-brand-b)" : "#E5484D" }}>
              {result.correct ? "정답이에요!" : "아쉬워요"}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.6, color: "var(--c-text-2d)" }}>
              정답은 <b>{result.answer ? "O" : "X"}</b>
              {result.explanation ? ` — ${result.explanation}` : ""}
            </p>
            <button
              type="button"
              onClick={() => onDone("answered")}
              style={{
                width: "100%", height: 48, border: "none", borderRadius: 12,
                background: "var(--c-brand)", color: "#fff", fontSize: 15.5, fontWeight: 900, cursor: "pointer",
              }}
            >
              계속 공부하기
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 4px", fontSize: 15.5, fontWeight: 800, lineHeight: 1.55, color: "var(--c-text-b)" }}>
              {check.question}
            </p>
            <p style={{ margin: "8px 0 16px", fontSize: 12, lineHeight: 1.6, color: "var(--c-text-5)" }}>
              답하지 않으면 타이머가 자동으로 꺼져요.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(true)}
                style={{
                  flex: 1, height: 56, borderRadius: 14, border: "1.5px solid var(--c-brand)",
                  background: "var(--c-brand-soft-3)", color: "var(--c-brand-deep)",
                  fontSize: 20, fontWeight: 900, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                }}
              >
                O
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(false)}
                style={{
                  flex: 1, height: 56, borderRadius: 14, border: "1.5px solid #E5484D",
                  background: "#FDECEC", color: "#D63A3A",
                  fontSize: 20, fontWeight: 900, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                }}
              >
                X
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // SSR 에서는 document 가 없다. 마운트 플래그 대신 이걸로 가른다(DailyQuizCard 와 동일).
  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
