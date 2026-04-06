"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface VocabQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
}

const SLOT_EMOJIS = ["🎯", "🧠", "🎰", "📚", "✨", "💡", "🔤", "🎓"];

export default function VocabQuizListPage() {
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<VocabQuizSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    fetch("/api/vocab-quiz")
      .then((res) => res.json())
      .then((data) => {
        setQuizSets(data.vocabQuizSets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#7C5CFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 500, margin: "0 auto", backgroundColor: "#7C5CFC", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => router.back()}
        className="press"
        style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 40px" }}>
        {/* Slot Machine */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 48 }}>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              style={{
                width: 80,
                height: 80,
                overflow: "hidden",
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.15)",
                position: "relative",
              }}
            >
              <div style={{
                display: "flex",
                flexDirection: "column",
                animation: `slotSpin${row} ${3 + row * 1}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
              }}>
                {[...SLOT_EMOJIS, ...SLOT_EMOJIS].map((emoji, i) => (
                  <span key={i} style={{ fontSize: 48, lineHeight: "80px", textAlign: "center", display: "block" }}>
                    {emoji}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          영단어 퀴즈
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
          로그인하시고 도전해보세요!
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }} className="quiz-list-scroll">
          {quizSets.map((qs, i) => (
            <button
              key={qs.id}
              type="button"
              onClick={() => router.push(`/vocab-quiz/${qs.id}`)}
              className="press"
              style={{
                width: "100%", padding: "18px 24px", borderRadius: 16, backgroundColor: "#fff",
                border: "none", fontSize: 16, fontWeight: 600, color: "#111", textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)", flexShrink: 0,
                animation: `quizItemFadeUp 0.5s ${0.08 * i}s both`,
              }}
            >
              {qs.title}
            </button>
          ))}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>등록된 단어 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, #7C5CFC, transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
        @keyframes slotSpin0 {
          0% { transform: translateY(0); }
          18% { transform: translateY(${-SLOT_EMOJIS.length * 80}px); }
          22% { transform: translateY(${-2 * 80}px); }
          88% { transform: translateY(${-2 * 80}px); }
          100% { transform: translateY(0); }
        }
        @keyframes slotSpin1 {
          0% { transform: translateY(0); }
          28% { transform: translateY(${-SLOT_EMOJIS.length * 80}px); }
          32% { transform: translateY(${-4 * 80}px); }
          82% { transform: translateY(${-4 * 80}px); }
          100% { transform: translateY(0); }
        }
        @keyframes slotSpin2 {
          0% { transform: translateY(0); }
          38% { transform: translateY(${-SLOT_EMOJIS.length * 80}px); }
          42% { transform: translateY(${-1 * 80}px); }
          78% { transform: translateY(${-1 * 80}px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
