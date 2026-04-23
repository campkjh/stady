"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface VocabQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
}

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
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #E8F0FE 0%, #DEE9FB 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7EA6E8]/30 border-t-[#7EA6E8]" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 500, margin: "0 auto", background: "linear-gradient(180deg, #E8F0FE 0%, #DEE9FB 100%)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => router.back()}
        className="press"
        style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none", zIndex: 10 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7EA6E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#7EA6E8", textAlign: "center", marginBottom: 28 }}>
          영단어 퀴즈
        </h1>

        {/* Stacked VOCA Cards */}
        <div style={{ position: "relative", width: 240, height: 140, marginBottom: 28 }}>
          <div style={{
            position: "absolute", right: -8, top: 8, width: 220, height: 130,
            borderRadius: 18, backgroundColor: "rgba(255,255,255,0.6)",
            boxShadow: "0 6px 20px rgba(126,166,232,0.15)",
            animation: "vocaCardBack 3s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", left: 0, top: 0, width: 220, height: 130,
            borderRadius: 18, backgroundColor: "#fff",
            boxShadow: "0 10px 28px rgba(126,166,232,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #BFD4F2",
            animation: "vocaCardFront 3s ease-in-out infinite",
          }}>
            <span style={{
              fontSize: 56, fontWeight: 900, letterSpacing: -2,
              color: "#C8D6EE",
              textShadow: "0 3px 8px rgba(126,166,232,0.25)",
            }}>
              VOCA
            </span>
          </div>
        </div>

        <p style={{ fontSize: 18, color: "#9BB4DC", textAlign: "center", fontWeight: 700 }}>
          수능 필수 영단어 2000개
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
                width: "100%", padding: "20px 24px", borderRadius: 20, backgroundColor: "#fff",
                border: "1px solid #D9E3F5", fontSize: 16, fontWeight: 700, color: "#2B313D", textAlign: "center",
                boxShadow: "0 4px 16px rgba(126,166,232,0.12)", flexShrink: 0,
                animation: `quizItemFadeUp 0.5s ${0.08 * i}s both`,
              }}
            >
              {qs.title}
            </button>
          ))}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "#9BB4DC", fontSize: 14 }}>등록된 단어 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, #DEE9FB, transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        @keyframes vocaCardFront {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(-1deg); }
        }
        @keyframes vocaCardBack {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
