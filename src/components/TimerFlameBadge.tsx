"use client";

import { FLAME_TIERS, flameTierFor, flameNext, flameProgress } from "@/lib/timerBadge";

function hours(seconds: number) {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.floor(h)}시간`;
  if (h >= 1) return `${h.toFixed(1)}시간`;
  return `${Math.max(0, Math.round(seconds / 60))}분`;
}

/** 이름 옆에 붙이는 작은 불꽃 등급 칩. */
export function FlameChip({ totalSeconds, size = 13 }: { totalSeconds: number; size?: number }) {
  const t = flameTierFor(totalSeconds);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle",
        padding: "2px 7px 2px 5px", borderRadius: 999,
        background: t.soft, color: t.color, fontSize: size - 2, fontWeight: 800, whiteSpace: "nowrap",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.icon} alt="" width={size} height={size} style={{ display: "block" }} />
      {t.name}
    </span>
  );
}

/** 뱃지 탭 맨 위에 놓는 8단계 등급 카드(현재 등급 + 다음 등급까지 진행도 + 전체 단계). */
export default function TimerFlameBadge({ totalSeconds }: { totalSeconds: number }) {
  const tier = flameTierFor(totalSeconds);
  const next = flameNext(totalSeconds);
  const pct = Math.round(flameProgress(totalSeconds) * 100);

  return (
    <section
      style={{
        borderRadius: 18, border: "1px solid var(--c-bg-muted-9)", background: "var(--c-bg)",
        padding: 16, marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 52, height: 52, borderRadius: "50%", background: tier.soft,
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tier.icon} alt="" width={30} height={30} style={{ display: "block" }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: tier.color }}>{tier.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--c-text-4b)", fontWeight: 600, marginTop: 2 }}>
            누적 공부 {hours(totalSeconds)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={{ height: 8, borderRadius: 999, background: "var(--c-bg-muted-7)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: tier.color, borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--c-text-4b)", marginTop: 6, fontWeight: 600, textAlign: "right" }}>
          {next
            ? `다음 등급(${next.tier.name})까지 ${hours(next.remainSeconds)}`
            : "최고 등급이에요"}
        </div>
      </div>

      {/* 8단계 한눈에 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, marginTop: 14 }}>
        {FLAME_TIERS.map((t) => {
          const reached = totalSeconds >= t.minSeconds;
          return (
            <div key={t.id} style={{ textAlign: "center" }} title={`${t.name} · 누적 ${hours(t.minSeconds)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.icon}
                alt=""
                width={22}
                height={22}
                style={{ display: "block", margin: "0 auto", filter: reached ? "none" : "grayscale(1)", opacity: reached ? 1 : 0.3 }}
              />
              <span style={{ display: "block", fontSize: 9.5, marginTop: 3, fontWeight: reached ? 800 : 600, color: reached ? t.color : "var(--c-text-5)" }}>
                {t.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
