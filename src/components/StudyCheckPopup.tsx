"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useModalExit } from "@/lib/useModalExit";

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
  useBodyScrollLock(true);
  const { leaving, exit } = useModalExit();
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
    <div data-gate="study-check" className={`mdl-root${leaving ? " is-leaving" : ""}`} style={{ zIndex: 2600, padding: 20 }}>
      <div className="mdl-dim" style={{ background: "rgba(0,0,0,0.58)" }} />
      <div className="mdl-card is-wide">
        <div className="mdl-text">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/flame/f4.svg" alt="" width={18} height={18} style={{ display: "block" }} />
            <span className="mdl-tag" style={{ padding: "3px 9px" }}>공부 중 확인</span>
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--mdl-sub)" }}>{deadline}까지</span>
          </div>

          {result ? (
            <>
              <h2 className="mdl-title" style={{ color: result.correct ? "var(--mdl-accent)" : "var(--mdl-danger)" }}>
                {result.correct ? "정답이에요!" : "아쉬워요"}
              </h2>
              <p className="mdl-body is-sm">
                정답은 <b>{result.answer ? "O" : "X"}</b>
                {result.explanation ? ` — ${result.explanation}` : ""}
              </p>
            </>
          ) : (
            <>
              <h2 className="mdl-title" style={{ fontSize: 19, lineHeight: 1.5 }}>{check.question}</h2>
              <p className="mdl-cap">답하지 않으면 타이머가 자동으로 꺼져요.</p>
            </>
          )}
        </div>

        {result ? (
          <div className="mdl-actions">
            <button type="button" className="mdl-btn is-main" onClick={() => exit(() => onDone("answered"))}>
              계속 공부하기
            </button>
          </div>
        ) : (
          <div className="mdl-actions">
            <button type="button" className="mdl-btn is-main" disabled={busy} onClick={() => answer(true)} style={{ fontSize: 22 }}>
              O
            </button>
            <button type="button" className="mdl-btn is-danger" disabled={busy} onClick={() => answer(false)} style={{ fontSize: 22 }}>
              X
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // SSR 에서는 document 가 없다. 마운트 플래그 대신 이걸로 가른다(DailyQuizCard 와 동일).
  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
