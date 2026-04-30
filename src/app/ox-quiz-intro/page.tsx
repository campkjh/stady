"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
}

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
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#7BC5E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, maxWidth: 500, margin: "0 auto", backgroundColor: "#7BC5E8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px 20px" }}>
        {/* OX Blocks */}
        <div style={{ display: "flex", gap: 16, marginBottom: 48, animation: "oxBlockAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={{
            width: 120, height: 120, borderRadius: 24,
            backgroundColor: "#2E75E3",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 28px rgba(46,117,227,0.35)",
            animation: "oxBounceL 2.2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 90, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -2 }}>O</span>
          </div>
          <div style={{
            width: 120, height: 120, borderRadius: 24,
            backgroundColor: "#E8453C",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 28px rgba(232,69,60,0.35)",
            animation: "oxBounceR 2.2s ease-in-out 0.3s infinite",
          }}>
            <span style={{ fontSize: 90, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -2 }}>X</span>
          </div>
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 12 }}>
          하루에 한 번 OX퀴즈
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", textAlign: "center" }}>
          로그인하시고 도전해보세요!
        </p>
      </div>

      <div style={{ position: "relative", padding: "0 20px 40px", flexShrink: 0 }}>
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }} className="quiz-list-scroll">
          {(() => {
            // Group quiz sets by parent topic (parsed from title)
            const groups: { name: string; items: OxQuizSet[] }[] = [];
            const findOrCreateGroup = (name: string) => {
              let g = groups.find((x) => x.name === name);
              if (!g) { g = { name, items: [] }; groups.push(g); }
              return g;
            };
            for (const qs of quizSets) {
              const t = qs.title;
              if (t.includes("윤리학의 분류")) findOrCreateGroup("윤리학").items.push(qs);
              else if (t.includes("죽음관")) findOrCreateGroup("죽음관").items.push(qs);
              else if (t.includes("직업관")) findOrCreateGroup("직업관").items.push(qs);
              else if (t.includes("분배")) findOrCreateGroup("분배 정의").items.push(qs);
              else if (t.includes("동양 윤리") || t.includes("서양 윤리")) findOrCreateGroup("동·서양 윤리").items.push(qs);
              else findOrCreateGroup("기타").items.push(qs);
            }

            let runningIdx = 0;
            return groups.map((group) => (
              <div key={group.name}>
                <p style={{
                  fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.95)",
                  margin: "4px 4px 8px", letterSpacing: 0.2,
                }}>
                  {group.name}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {group.items.map((qs) => {
                    const animIdx = runningIdx++;
                    return (
                      <button
                        key={qs.id}
                        type="button"
                        onClick={() => router.push(`/ox-quiz/${qs.id}`)}
                        className="press"
                        style={{
                          width: "100%", padding: "18px 22px", borderRadius: 18, backgroundColor: "#fff",
                          border: "none", fontSize: 15, fontWeight: 700, color: "#2B313D", textAlign: "center",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", flexShrink: 0,
                          animation: `quizItemFadeUp 0.5s ${0.06 * animIdx}s both`,
                        }}
                      >
                        {qs.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
          {quizSets.length === 0 && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 14 }}>등록된 OX 퀴즈가 없습니다.</p>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 40, left: 20, right: 20, height: 48,
          background: "linear-gradient(to top, #7BC5E8, transparent)",
          pointerEvents: "none",
        }} />
      </div>

      <style>{`
        @keyframes oxBlockAppear {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes oxBounceL {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes oxBounceR {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
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
