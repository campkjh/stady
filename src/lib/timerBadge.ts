// 타이머 불꽃 등급 8단계. **이번 주 공부시간(초)** 으로 결정되고 매주 월요일(KST)에 초기화된다.
//
// 커뮤니티 등급(아이언~공신, lib/community.ts)과는 별개다 — 저쪽은 글·댓글 활동 점수,
// 이쪽은 순수 공부시간이다. 아이콘은 토스 불꽃 아이콘을 단계 색으로 다시 칠한 것
// (public/icons/flame/f1~f8.svg). 색은 숯 → 주황 → 빨강 → 핑크 → 보라 → 파랑 → 금색으로
// "불이 점점 뜨거워지는" 순서다.
//
// 임계값은 주간 분포에 맞췄다(주간 상위가 50h대, 3위권이 10h 안팎). 누적 기준으로 잡으면
// 한 주 만에 닿을 수 없어 전원이 불씨에 머문다.
export interface FlameTier {
  id: string;
  name: string;
  /** 이 등급이 되는 최소 주간 공부시간(초) */
  minSeconds: number;
  icon: string;
  /** 뱃지 글자/테두리 색 */
  color: string;
  /** 뱃지 배경(옅은 톤) */
  soft: string;
}

const H = 3600;

export const FLAME_TIERS: FlameTier[] = [
  { id: "ember",     name: "불씨",   minSeconds: 0,      icon: "/icons/flame/f1.svg", color: "#8A7266", soft: "#F4EFEC" },
  { id: "spark",     name: "잔불",   minSeconds: 1 * H,  icon: "/icons/flame/f2.svg", color: "#D9661F", soft: "#FFF1E4" },
  { id: "campfire",  name: "모닥불", minSeconds: 3 * H,  icon: "/icons/flame/f3.svg", color: "#E8541A", soft: "#FFEDE4" },
  { id: "bonfire",   name: "화톳불", minSeconds: 7 * H,  icon: "/icons/flame/f4.svg", color: "#E0203F", soft: "#FFE9EC" },
  { id: "torch",     name: "횃불",   minSeconds: 12 * H, icon: "/icons/flame/f5.svg", color: "#C82A78", soft: "#FFE8F3" },
  { id: "wildfire",  name: "들불",   minSeconds: 20 * H, icon: "/icons/flame/f6.svg", color: "#7248E0", soft: "#F0EAFF" },
  { id: "pillar",    name: "불기둥", minSeconds: 30 * H, icon: "/icons/flame/f7.svg", color: "#1E6BE0", soft: "#E6F0FF" },
  { id: "phoenix",   name: "불사조", minSeconds: 45 * H, icon: "/icons/flame/f8.svg", color: "#C98A00", soft: "#FFF6DF" },
];

/** 이번 주 공부시간(초)에 해당하는 등급. 항상 하나는 나온다(0초 = 불씨). */
export function flameTierFor(totalSeconds: number): FlameTier {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  let cur = FLAME_TIERS[0];
  for (const t of FLAME_TIERS) if (s >= t.minSeconds) cur = t;
  return cur;
}

/** 다음 등급(최고 등급이면 null)과 남은 시간(초). */
export function flameNext(totalSeconds: number): { tier: FlameTier; remainSeconds: number } | null {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const next = FLAME_TIERS.find((t) => s < t.minSeconds);
  return next ? { tier: next, remainSeconds: next.minSeconds - s } : null;
}

/** 진행 막대용 0~1. 최고 등급이면 1. */
export function flameProgress(totalSeconds: number): number {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const cur = flameTierFor(s);
  const next = flameNext(s);
  if (!next) return 1;
  const span = next.tier.minSeconds - cur.minSeconds;
  return span > 0 ? Math.min(1, Math.max(0, (s - cur.minSeconds) / span)) : 0;
}
