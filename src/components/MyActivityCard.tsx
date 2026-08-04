"use client";

import { useEffect, useState } from "react";
import { clientCache } from "@/lib/clientCache";

interface Activity {
  score: number;
  tier: string;
  currentMin: number;
  nextTier: string | null;
  nextMin: number | null;
}

const TIERS = ["iron", "silver", "gold", "emerald", "diamond", "master"];
// 등급별 필요 경험치(서버 TIER_THRESHOLDS와 동일하게 유지할 것).
const TIER_MIN: Record<string, number> = {
  iron: 0, silver: 40, gold: 120, emerald: 300, diamond: 600, master: 1200,
};
// 경험치 가중치(서버 getUserActivityScore와 동일).
const XP_RULES = [
  { emoji: "✍️", label: "커뮤니티 글 쓰기", xp: 10 },
  { emoji: "💬", label: "댓글 남기기", xp: 3 },
  { emoji: "❤️", label: "내 글이 공감 받기", xp: 2 },
  { emoji: "🧠", label: "데일리 퀴즈 정답", xp: 5 },
  { emoji: "📝", label: "퀴즈 풀기(1회)", xp: 1 },
];
const LABEL: Record<string, string> = {
  iron: "아이언",
  silver: "실버",
  gold: "골드",
  emerald: "에메랄드",
  diamond: "다이아",
  master: "마스터",
};

const CACHE_KEY = "me-activity";

export default function MyActivityCard() {
  const [data, setData] = useState<Activity | null>(() => clientCache.get<Activity>(CACHE_KEY) ?? null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/activity", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: Activity | null) => {
        if (!alive || !d || typeof d.score !== "number") return;
        if (clientCache.set(CACHE_KEY, d)) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;

  const { score, tier, currentMin, nextTier, nextMin } = data;
  const currentIdx = TIERS.indexOf(tier);
  const pct =
    nextMin != null && nextMin > currentMin
      ? Math.max(4, Math.min(100, Math.round(((score - currentMin) / (nextMin - currentMin)) * 100)))
      : 100;
  const remain = nextMin != null ? Math.max(0, nextMin - score) : 0;

  return (
    <section style={{ padding: "16px 20px" }}>
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #EEF0F3",
          background: "#fff",
          boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
          padding: 18,
        }}
      >
        {/* 등급 + 경험치 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/icons/tier-${tier}.svg`} alt="" width={46} height={46} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#191F28" }}>
              {LABEL[tier] ?? "아이언"}
              <span style={{ color: "#8B95A1", fontSize: 13, fontWeight: 600, marginLeft: 4 }}>등급</span>
            </div>
            <div style={{ fontSize: 13.5, color: "#8B95A1", marginTop: 3, fontWeight: 600 }}>
              경험치 {score.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* 다음 등급까지 진행도 */}
        <div style={{ marginTop: 15 }}>
          <div style={{ height: 8, borderRadius: 999, background: "#EEF1F5", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg, #7DC4FF, #3787FF)",
                borderRadius: 999,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#8B95A1", marginTop: 6, textAlign: "right", fontWeight: 500 }}>
            {nextTier ? `다음 등급(${LABEL[nextTier]})까지 ${remain.toLocaleString()} XP` : "최고 등급 달성 🎉"}
          </div>
        </div>

        {/* 뱃지 현황 */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F2F4F6" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#191F28", marginBottom: 12 }}>뱃지 현황</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
            {TIERS.map((t, i) => {
              const earned = i <= currentIdx;
              return (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/icons/tier-${t}.svg`}
                    alt=""
                    width={30}
                    height={30}
                    style={{ filter: earned ? "none" : "grayscale(1)", opacity: earned ? 1 : 0.3 }}
                  />
                  <span style={{ fontSize: 10, color: earned ? "#4E5968" : "#B0B8C1", fontWeight: earned ? 700 : 500 }}>
                    {LABEL[t]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 등급 올리는 법 — chevron으로 접고 펼치기 */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #F2F4F6" }}>
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            aria-expanded={guideOpen}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              background: "none", border: "none", padding: "2px 0", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#191F28" }}>등급은 이렇게 올라가요</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: "auto", transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {guideOpen && (
            <div className="tier-guide" style={{ marginTop: 10 }}>
              {/* 경험치 쌓는 방법 */}
              <div style={{ background: "#F7F9FC", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800, color: "#4E5968" }}>경험치(XP) 쌓는 방법</p>
                <div style={{ display: "grid", gap: 6 }}>
                  {XP_RULES.map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{r.emoji}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#4E5968", fontWeight: 600 }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#3787FF", fontVariantNumeric: "tabular-nums" }}>+{r.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 등급별 필요 경험치 */}
              <div style={{ marginTop: 10, display: "grid", gap: 2 }}>
                {TIERS.map((t, i) => {
                  const min = TIER_MIN[t];
                  const isCurrent = t === tier;
                  const earned = i <= currentIdx;
                  return (
                    <div
                      key={t}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 10,
                        background: isCurrent ? "#EEF5FF" : "transparent",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/icons/tier-${t}.svg`} alt="" width={26} height={26}
                        style={{ flexShrink: 0, filter: earned ? "none" : "grayscale(1)", opacity: earned ? 1 : 0.35 }} />
                      <span style={{ fontSize: 13.5, fontWeight: isCurrent ? 800 : 700, color: isCurrent ? "#1F5EDC" : "#191F28" }}>
                        {LABEL[t]}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#3787FF", borderRadius: 999, padding: "2px 7px" }}>
                          현재
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#8B95A1", fontVariantNumeric: "tabular-nums" }}>
                        {min === 0 ? "가입 시 시작" : `${min.toLocaleString()} XP 이상`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p style={{ margin: "10px 2px 0", fontSize: 11.5, lineHeight: 1.6, color: "#8B95A1" }}>
                경험치는 커뮤니티 활동과 퀴즈 풀이가 쌓일수록 자동으로 올라가요. 등급이 오르면 커뮤니티 닉네임 옆 뱃지도 함께 바뀝니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tier-guide { animation: tierGuideIn 0.24s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes tierGuideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .tier-guide { animation: none; } }
      `}</style>
    </section>
  );
}
