"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
}

const EMOJIS = ["👀", "✌️", "🤷‍♀️", "😱", "🤔", "🎉", "💪", "🔥", "⭐", "🏆"];

export default function OxQuizListPage() {
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<OxQuizSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    fetch("/api/ox-quiz")
      .then((res) => res.json())
      .then((data) => {
        setQuizSets(data.oxQuizSets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#3787FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const emojiSet = [...EMOJIS, ...EMOJIS];

  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 500, margin: "0 auto", backgroundColor: "#3787FF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0 40px" }}>
        {/* Marquee Emojis - 가로 무한 루프 */}
        <div style={{ width: "100%", overflow: "hidden", marginBottom: 60 }}>
          <div style={{
            display: "flex",
            gap: 32,
            animation: "marqueeWave 12s linear infinite",
            width: "max-content",
          }}>
            {emojiSet.map((emoji, i) => (
              <span
                key={i}
                style={{
                  fontSize: 56,
                  flexShrink: 0,
                  animation: `emojiWave 2.5s ease-in-out ${i * 0.25}s infinite`,
                }}
              >
                {emoji}
              </span>
            ))}
          </div>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          하루에 한 번 OX퀴즈
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
              onClick={() => router.push(`/ox-quiz/${qs.id}`)}
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
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>등록된 OX 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, #3787FF, transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        @keyframes quizItemFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-list-scroll::-webkit-scrollbar { display: none; }
        @keyframes marqueeWave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes emojiWave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
