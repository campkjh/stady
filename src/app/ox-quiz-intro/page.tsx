"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OxQuizSet {
  id: string;
  title: string;
  difficulty: string;
  totalQuestions: number;
  category?: { id: string; name: string } | null;
  questions?: { section: string | null }[];
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
            const groups = quizSets.reduce<{ name: string; items: OxQuizSet[] }[]>((acc, qs) => {
              const name = qs.category?.name ? `${qs.category.name} OX 퀴즈` : "OX 퀴즈";
              const group = acc.find((item) => item.name === name);
              if (group) group.items.push(qs);
              else acc.push({ name, items: [qs] });
              return acc;
            }, []);

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
                    const sections = Array.from(new Set((qs.questions ?? []).map((q) => q.section).filter(Boolean))) as string[];
                    return (
                      <button
                        key={qs.id}
                        type="button"
                        onClick={() => router.push(`/ox-quiz/${qs.id}`)}
                        className="press"
                        style={{
                          width: "100%", padding: "16px 18px", borderRadius: 18, backgroundColor: "#fff",
                          border: "none", color: "#2B313D", textAlign: "left",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", flexShrink: 0,
                          animation: `quizItemFadeUp 0.5s ${0.06 * animIdx}s both`,
                        }}
                      >
                        <span style={{ display: "block", fontSize: 15, fontWeight: 800, textAlign: "center" }}>
                          {qs.title}
                        </span>
                        <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 600, color: "#8A909C", textAlign: "center" }}>
                          {sections.length}개 소분류 · {qs.totalQuestions}문항
                        </span>
                        {sections.length > 0 && (
                          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
                            {sections.slice(0, 4).map((section) => (
                              <span
                                key={section}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  backgroundColor: "#EBF3FF",
                                  color: "#3787FF",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {section}
                              </span>
                            ))}
                            {sections.length > 4 && (
                              <span style={{ padding: "4px 8px", borderRadius: 999, backgroundColor: "#F3F4F6", color: "#8A909C", fontSize: 11, fontWeight: 700 }}>
                                +{sections.length - 4}
                              </span>
                            )}
                          </span>
                        )}
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
