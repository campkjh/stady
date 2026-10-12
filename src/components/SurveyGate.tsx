"use client";

import { useEffect, useState } from "react";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

// 첫 진입 시 평생 1회 노출되는 온보딩 설문(만족도 + 원하는 기능).
// 응답/건너뛰기 시 서버에 1행 기록되어 다시는 뜨지 않는다.

const FACES: { v: number; emoji: string; label: string }[] = [
  { v: 1, emoji: "😞", label: "별로예요" },
  { v: 2, emoji: "😐", label: "그저그래요" },
  { v: 3, emoji: "🙂", label: "보통이에요" },
  { v: 4, emoji: "😀", label: "좋아요" },
  { v: 5, emoji: "🤩", label: "최고예요" },
];

export default function SurveyGate() {
  const [open, setOpen] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [feature, setFeature] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    fetch("/api/survey", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || d.answered !== false) return;
        // 페이지가 자리잡은 뒤(웰컴 등과 겹치지 않게) 잠시 후 노출.
        timer = setTimeout(() => {
          if (alive) setOpen(true);
        }, 900);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function submit(skipped: boolean) {
    if (busy) return;
    if (!skipped && satisfaction == null) return;
    setBusy(true);
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ skipped, satisfaction, desiredFeature: feature }),
      });
    } catch {
      // 실패해도 모달은 닫는다(추후 재노출은 서버 기록 여부로 결정).
    }
    setOpen(false);
    setBusy(false);
  }

  useBodyScrollLock(open);
  if (!open) return null;

  return (
    <div data-gate="survey" className="mdl-root is-float" style={{ zIndex: 1000 }}>
      <div className="mdl-dim" style={{ background: "rgba(0,0,0,0.45)" }} />
      <div className="mdl-card is-wider">
        <div className="mdl-scroll mdl-text" style={{ paddingBottom: 4 }}>
          <h2 className="mdl-title">스타디, 어떻게 쓰고 계신가요?</h2>
          <p className="mdl-body is-sm">
            처음 한 번만 여쭤봐요. 더 나은 스타디를 만드는 데 큰 힘이 됩니다 <img src="/icons/toss/folded-hands.svg" alt="" style={{ width: 16, height: 16, verticalAlign: "middle", display: "inline-block" }} />
          </p>

          {/* 만족도 */}
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--mdl-title)", margin: "22px 0 10px" }}>만족도를 선택해주세요</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {FACES.map((f) => {
              const active = satisfaction === f.v;
              return (
                <button
                  key={f.v}
                  type="button"
                  className="daily-opt"
                  onClick={() => setSatisfaction(f.v)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "11px 2px",
                    borderRadius: 17, border: "none", fontFamily: "inherit",
                    background: active ? "rgba(49,130,246,0.12)" : "var(--mdl-field)",
                    boxShadow: active ? "inset 0 0 0 2px rgba(49,130,246,0.6)" : "none",
                  }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{f.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 600, color: active ? "var(--mdl-accent)" : "var(--mdl-sub)" }}>
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 원하는 기능 */}
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--mdl-title)", margin: "22px 0 10px" }}>
            추가됐으면 하는 기능이 있나요? <span style={{ color: "var(--mdl-sub)", fontWeight: 500, fontSize: 13 }}>(선택)</span>
          </p>
          <textarea
            className="mdl-field"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            placeholder="예) 오답노트 복습 알림, 친구와 점수 비교 등"
            rows={3}
            style={{ fontSize: 16 }}
          />
        </div>

        {/* 버튼 */}
        <div className="mdl-actions is-stack is-tight" style={{ gap: 0 }}>
          <button
            type="button"
            className="mdl-btn is-main"
            style={{ flex: "none", width: "100%" }}
            disabled={busy || satisfaction == null}
            onClick={() => submit(false)}
          >
            제출하기
          </button>
          <button type="button" className="mdl-textbtn is-muted" style={{ alignSelf: "center", marginTop: 2 }} disabled={busy} onClick={() => submit(true)}>
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}
