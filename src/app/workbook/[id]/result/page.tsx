"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface ProblemResult {
  id: string;
  problemId: string;
  selected: number | null;
  isCorrect: boolean;
  dwellSeconds: number;
  problem: {
    id: string;
    order: number;
    questionText: string | null;
    passageImage: string | null;
    answer: number;
  };
}

interface AnalysisSection {
  title: string;
  body: string;
  tone: "good" | "warn" | "info";
}

interface Analysis {
  stats: {
    total: number; correctCount: number; wrongCount: number; correctRate: number;
    totalDwellSeconds: number; avgDwellSeconds: number;
  };
  sections: AnalysisSection[];
  problemDwells: { order: number; dwellSeconds: number; isCorrect: boolean }[];
}

function formatDwell(sec: number) {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const score = Number(searchParams.get("score") || 0);
  const total = Number(searchParams.get("total") || 0);
  const timeTaken = Number(searchParams.get("time") || 0);
  const attemptId = searchParams.get("attemptId");

  const [results, setResults] = useState<ProblemResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    if (!attemptId) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/attempts?attemptId=${attemptId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.answers || []);
        }
      } catch {}
      setLoading(false);
    })();
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId || analysis || analysisLoading) return;
    setAnalysisLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/attempts/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);
        }
      } catch {}
      setAnalysisLoading(false);
    })();
  }, [attemptId, analysis, analysisLoading]);

  const scorePerProblem = total > 0 ? Math.round(100 / total) : 5;
  const totalPoints = score * scorePerProblem;
  const correctRate = total > 0 ? Math.round((score / total) * 100) : 0;

  const sortedResults = [...results].sort((a, b) => a.problem.order - b.problem.order);

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "12px 16px", background: "#fff" }}>
        <button
          onClick={() => router.push("/")}
          className="press"
          style={{ width: 36, height: 36, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Score Hero */}
      <div style={{ background: "#fff", padding: "16px 20px 32px", textAlign: "center", borderBottom: "1px solid #F3F4F6" }}>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>
          {correctRate >= 80 ? "잘했어요!" : correctRate >= 50 ? "조금 더 연습해봐요" : "기초부터 다시 해볼까요?"}
        </p>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: "#111", letterSpacing: -2 }}>
            {totalPoints}
          </span>
          <span style={{ fontSize: 22, color: "#9CA3AF", fontWeight: 600 }}>
            / {total * scorePerProblem}점
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>소요 시간 {formatTime(timeTaken)} · 정답률 {correctRate}%</p>

        <div style={{ marginTop: 20, maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
          <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${correctRate}%`,
              background: "linear-gradient(90deg, #3787FF 0%, #5CA3FF 100%)",
              borderRadius: 4, transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#9CA3AF" }}>
            <span>정답 {score}문제</span>
            <span>오답 {total - score}문제</span>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 6,
            background: "linear-gradient(135deg, #3787FF, #7B5BFF)",
            color: "#fff", fontSize: 11, fontWeight: 800,
          }}>AI</span>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>스타디 AI 분석</h2>
        </div>
        {analysisLoading || !analysis ? (
          <div style={{
            background: "#fff", borderRadius: 14, padding: 20, textAlign: "center",
            border: "1px solid #F3F4F6",
          }}>
            <div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid #E5E7EB", borderTopColor: "#3787FF", borderRadius: "50%", animation: "resSpin 0.8s linear infinite" }} />
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>풀이 데이터를 분석하고 있어요...</p>
            <style>{`@keyframes resSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Stats summary */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: "14px 16px",
              border: "1px solid #F3F4F6",
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
            }}>
              <StatBox label="정답률" value={`${analysis.stats.correctRate}%`} color="#3787FF" />
              <StatBox label="평균 풀이시간" value={formatDwell(analysis.stats.avgDwellSeconds)} color="#111" />
              <StatBox label="총 풀이시간" value={formatDwell(analysis.stats.totalDwellSeconds)} color="#111" />
            </div>

            {/* Analysis sections */}
            {analysis.sections.map((s, i) => {
              const color = s.tone === "good" ? "#3787FF" : s.tone === "warn" ? "#EF4444" : "#6B7280";
              const bg = s.tone === "good" ? "#EAF2FF" : s.tone === "warn" ? "#FEF2F2" : "#F9FAFB";
              return (
                <div key={i} style={{
                  background: "#fff", borderRadius: 14, padding: "14px 16px",
                  border: "1px solid #F3F4F6",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: "50%", background: color,
                    }} />
                    <span style={{
                      fontSize: 11, fontWeight: 700, color, padding: "2px 8px",
                      borderRadius: 10, background: bg,
                    }}>
                      {s.tone === "good" ? "긍정" : s.tone === "warn" ? "주의" : "정보"}
                    </span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{s.title}</h3>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: "#374151" }}>{s.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Problem-by-problem results */}
      <div style={{ padding: "20px 16px 24px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 10 }}>문제별 결과</h2>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
            <div style={{ width: 22, height: 22, border: "2px solid #E5E7EB", borderTopColor: "#3787FF", borderRadius: "50%", animation: "resSpin 0.8s linear infinite" }} />
          </div>
        ) : sortedResults.length > 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #F3F4F6" }}>
            {sortedResults.map((r, i) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                borderBottom: i === sortedResults.length - 1 ? "none" : "1px solid #F3F4F6",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                  background: r.isCorrect ? "#3787FF" : "#EF4444",
                }}>
                  {r.problem.order}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    문제 {r.problem.order}
                    {r.selected !== null && <span style={{ color: "#9CA3AF", fontWeight: 500, marginLeft: 6 }}>· {r.selected}번 선택</span>}
                  </p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                    정답 {r.problem.answer}번 · 풀이 {formatDwell(r.dwellSeconds)}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: r.isCorrect ? "#3787FF" : "#EF4444",
                  padding: "3px 10px", borderRadius: 10,
                  background: r.isCorrect ? "#E8F0FE" : "#FEE2E2",
                }}>
                  {r.isCorrect ? "정답" : "오답"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 20 }}>
            상세 결과가 없습니다.
          </p>
        )}
      </div>

      {/* Bottom button */}
      <div style={{ position: "sticky", bottom: 0, background: "#F9FAFB", padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
        <button
          onClick={() => router.push(`/workbook/${id}`)}
          className="press"
          style={{
            flex: 1, height: 52, borderRadius: 14,
            background: "#F3F4F6", color: "#374151", border: "none",
            fontSize: 15, fontWeight: 700,
          }}
        >
          닫기
        </button>
        <button
          onClick={() => router.push(`/workbook/${id}/solve`)}
          className="press"
          style={{
            flex: 1, height: 52, borderRadius: 14,
            background: "#3787FF", color: "#fff", border: "none",
            fontSize: 15, fontWeight: 700,
          }}
        >
          다시 풀기
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: -0.3 }}>{value}</p>
    </div>
  );
}
