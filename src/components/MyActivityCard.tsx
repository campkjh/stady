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
      </div>
    </section>
  );
}
