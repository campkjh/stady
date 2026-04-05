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
      <div style={{ minHeight: "100vh", backgroundColor: "#3787FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const emojiSet = [...EMOJIS, ...EMOJIS];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#3787FF", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
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

      <div style={{ padding: "0 20px 60px", display: "flex", flexDirection: "column", gap: 12 }}>
        {quizSets.map((qs) => (
          <button
            key={qs.id}
            type="button"
            onClick={() => router.push(`/ox-quiz/${qs.id}`)}
            className="press"
            style={{ width: "100%", padding: "18px 24px", borderRadius: 16, backgroundColor: "#fff", border: "none", fontSize: 16, fontWeight: 600, color: "#111", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          >
            {qs.title}
          </button>
        ))}
        {quizSets.length === 0 && (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>등록된 OX 퀴즈가 없습니다.</p>
        )}
      </div>

      <style>{`
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
