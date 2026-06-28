"use client";

import { useEffect, useMemo, useState } from "react";

interface SurveyRow {
  id: string;
  userId: string;
  nickname: string;
  email: string;
  satisfaction: number | null;
  desiredFeature: string;
  skipped: boolean;
  createdAt: string;
}

const FACE: Record<number, string> = { 1: "😞", 2: "😐", 3: "🙂", 4: "😀", 5: "🤩" };
const SAT_LABEL: Record<number, string> = { 1: "별로예요", 2: "그저그래요", 3: "보통이에요", 4: "좋아요", 5: "최고예요" };

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/surveys", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { surveys: [] }))
      .then((data) => setSurveys(data.surveys || []))
      .catch(() => setSurveys([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const rated = surveys.filter((s) => typeof s.satisfaction === "number");
    const sum = rated.reduce((a, s) => a + (s.satisfaction || 0), 0);
    const avg = rated.length ? sum / rated.length : 0;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rated.forEach((s) => { if (s.satisfaction) dist[s.satisfaction]++; });
    const withFeature = surveys.filter((s) => s.desiredFeature.trim().length > 0).length;
    const skipped = surveys.filter((s) => s.skipped).length;
    return { total: surveys.length, rated: rated.length, avg, dist, withFeature, skipped };
  }, [surveys]);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>온보딩 설문</h1>
      <p style={{ fontSize: 13, color: "#8B95A1", margin: "0 0 20px" }}>
        사용자 첫 진입 시 1회 수집한 만족도·기능 요청입니다.
      </p>

      {/* 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="총 응답" value={`${stats.total}건`} />
        <StatCard label="평균 만족도" value={stats.rated ? `${stats.avg.toFixed(2)} / 5` : "-"} />
        <StatCard label="기능 요청" value={`${stats.withFeature}건`} />
        <StatCard label="건너뜀" value={`${stats.skipped}건`} />
      </div>

      {/* 만족도 분포 */}
      <div style={{ border: "1px solid #EEF0F3", borderRadius: 14, padding: 16, marginBottom: 22, background: "#fff" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>만족도 분포</div>
        {[5, 4, 3, 2, 1].map((v) => {
          const c = stats.dist[v] || 0;
          const pct = stats.rated ? Math.round((c / stats.rated) * 100) : 0;
          return (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 92, fontSize: 13, color: "#4E5968" }}>{FACE[v]} {SAT_LABEL[v]}</span>
              <div style={{ flex: 1, height: 10, background: "#F1F3F5", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#3787FF", borderRadius: 999 }} />
              </div>
              <span style={{ width: 56, textAlign: "right", fontSize: 12, color: "#8B95A1" }}>{c}명 ({pct}%)</span>
            </div>
          );
        })}
      </div>

      {/* 응답 목록 */}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>응답 목록 ({surveys.length})</div>
      {loading ? (
        <p style={{ color: "#8B95A1", fontSize: 14 }}>불러오는 중…</p>
      ) : surveys.length === 0 ? (
        <p style={{ color: "#8B95A1", fontSize: 14 }}>아직 설문 응답이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {surveys.map((s) => (
            <div key={s.id} style={{ border: "1px solid #EEF0F3", borderRadius: 12, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#191F28" }}>{s.nickname}</span>
                  {s.email && <span style={{ fontSize: 12, color: "#B0B8C1", marginLeft: 6 }}>{s.email}</span>}
                </div>
                <span style={{ fontSize: 12, color: "#B0B8C1", flexShrink: 0 }}>
                  {new Date(s.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                {s.skipped || s.satisfaction == null ? (
                  <span style={{ color: "#B0B8C1", fontWeight: 600 }}>건너뜀</span>
                ) : (
                  <span style={{ color: "#4E5968", fontWeight: 600 }}>
                    {FACE[s.satisfaction]} {SAT_LABEL[s.satisfaction]} ({s.satisfaction}/5)
                  </span>
                )}
              </div>
              {s.desiredFeature.trim() && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "#F7F8FA", borderRadius: 10, fontSize: 13.5, color: "#191F28", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {s.desiredFeature}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #EEF0F3", borderRadius: 12, padding: "14px 16px", background: "#fff" }}>
      <div style={{ fontSize: 12, color: "#8B95A1", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#191F28" }}>{value}</div>
    </div>
  );
}
