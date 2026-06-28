"use client";

import { useEffect, useState } from "react";

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

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="fade-in-up"
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          borderRadius: 22,
          padding: "24px 20px 18px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          marginBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "#191F28", margin: 0, lineHeight: 1.35 }}>
          스타디, 어떻게 쓰고 계신가요?
        </h2>
        <p style={{ fontSize: 13.5, color: "#8B95A1", margin: "8px 0 0", fontWeight: 500 }}>
          처음 한 번만 여쭤봐요. 더 나은 스타디를 만드는 데 큰 힘이 됩니다 🙏
        </p>

        {/* 만족도 */}
        <p style={{ fontSize: 14, fontWeight: 700, color: "#191F28", margin: "20px 0 10px" }}>
          만족도를 선택해주세요
        </p>
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
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 2px",
                  borderRadius: 14,
                  border: "none",
                  background: active ? "#E8F0FE" : "#F5F7FA",
                  boxShadow: active ? "inset 0 0 0 2px #3787FF" : "none",
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1 }}>{f.emoji}</span>
                <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? "#1D4ED8" : "#8B95A1" }}>
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 원하는 기능 */}
        <p style={{ fontSize: 14, fontWeight: 700, color: "#191F28", margin: "20px 0 10px" }}>
          추가됐으면 하는 기능이 있나요? <span style={{ color: "#B0B8C1", fontWeight: 500, fontSize: 12 }}>(선택)</span>
        </p>
        <textarea
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          placeholder="예) 오답노트 복습 알림, 친구와 점수 비교 등"
          rows={3}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 14,
            border: "1px solid #E5E8EB",
            background: "#FBFCFD",
            padding: "12px 14px",
            fontSize: 14,
            color: "#191F28",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        {/* 버튼 */}
        <button
          type="button"
          className="press-deep"
          disabled={busy || satisfaction == null}
          onClick={() => submit(false)}
          style={{
            width: "100%",
            marginTop: 18,
            height: 52,
            borderRadius: 14,
            border: "none",
            background: satisfaction == null ? "#C4D4F0" : "#3787FF",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            cursor: satisfaction == null ? "default" : "pointer",
          }}
        >
          제출하기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(true)}
          style={{
            width: "100%",
            marginTop: 8,
            height: 40,
            border: "none",
            background: "none",
            color: "#8B95A1",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
