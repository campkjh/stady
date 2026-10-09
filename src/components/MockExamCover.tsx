import { findSubject } from "@/lib/examSubjects";

/**
 * 모의고사 카드 표지 — 시험지 1쪽 대신 "봉투" 한 장을 그린다.
 *
 * 왜 이미지가 아니라 SVG 인가: 회차가 들어올 때마다 표지 이미지를 218장씩 만들어 올릴 수
 * 없다. 연도·과목·월만 있으면 같은 그림이 항상 똑같이 나오도록(결정적) 그린다.
 *
 * 구성(실물 봉투 레퍼런스와 같은 뼈대)
 *   · 윗부분 접힘(플랩) + 몸통 한 색 — 색은 **시행 연도**로 갈린다
 *   · 왼쪽에 끈 거는 구멍 두 개(흰 도넛)
 *   · 과목 첫 글자를 크게 깔고 그 안을 삼각 모자이크로 채운다 — **과목**마다 색·무늬가 다르다
 *   · 오른쪽 세로줄에 회차·과목·분량, 아래에 시행 월 숫자
 *   · 오른쪽 아래 스타디 로고
 */

// 시행 연도별 봉투 색. 흰 글씨가 또렷하게 얹히는 중간 톤으로 고른다.
const YEAR_PAPER = [
  "#6FBEDC", // 하늘
  "#EE9F57", // 살구
  "#86BE6B", // 연두
  "#AE93D6", // 라벤더
  "#E4868C", // 코랄
  "#5EB8A8", // 청록
];

// 과목 대분류별 모자이크 색. 봉투 바탕 위에서 튀는 형광 계열 + 검정 한 조각.
const GROUP_MOSAIC: Record<string, string[]> = {
  korean: ["#2FE0C4", "#1E6FE0", "#121C2B", "#8CE04A", "#FFFFFF"],
  math: ["#FF4FA3", "#7A4DF5", "#121C2B", "#4FC3FF", "#FFFFFF"],
  english: ["#FFD23F", "#FF7A45", "#121C2B", "#9BE564", "#FFFFFF"],
  social: ["#9BE564", "#FF4FA3", "#121C2B", "#3BB4F2", "#FFFFFF"],
  science: ["#3FE0A0", "#2BD1FF", "#121C2B", "#C2F24F", "#FFFFFF"],
  job: ["#FFB03A", "#2BD1FF", "#121C2B", "#FF6B6B", "#FFFFFF"],
  second: ["#C2F24F", "#B06BFF", "#121C2B", "#FF9F40", "#FFFFFF"],
};
const FALLBACK_MOSAIC = ["#8CE04A", "#FF4FA3", "#121C2B", "#3BB4F2", "#FFFFFF"];

/** 문자열 → 32비트 정수. 같은 과목이면 늘 같은 무늬가 나오게 하는 씨앗. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 씨앗에서 0~1 난수를 차례로 뽑는다(mulberry32). */
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 색을 어둡게/밝게(0~1, 음수면 어둡게). 플랩 음영용. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 과목 라벨 → 크게 깔 글자 한 자와 Ⅰ/Ⅱ 표시. */
function glyphOf(label: string | null): { big: string; roman: string } {
  if (!label) return { big: "모", roman: "" };
  const roman = /Ⅱ$/.test(label) ? "Ⅱ" : /Ⅰ$/.test(label) ? "Ⅰ" : "";
  return { big: label.trim().charAt(0), roman };
}

/** 제목을 봉투 오른쪽에 세울 2줄로 자른다("2025학년도 / 9월 모의평가"). */
function splitTitle(title: string): string[] {
  const m = title.match(/^(\S*학년도)\s+(.*)$/);
  if (m) return [m[1], m[2]];
  const parts = title.split(" ");
  if (parts.length < 2) return [title];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
}

export default function MockExamCover({
  title,
  subject,
  year,
  month,
  pageCount,
}: {
  title: string;
  subject: string | null;
  year: number | null;
  month: number | null;
  pageCount: number;
}) {
  const hit = findSubject(subject);
  const label = hit?.subject.label ?? null;
  const groupKey = hit?.group.key ?? "";
  const seed = hash(`${subject ?? "x"}|${groupKey}`);
  const rand = rng(seed);

  const paper = YEAR_PAPER[(year ?? 0) % YEAR_PAPER.length];
  const flap = shade(paper, -0.08);
  const mosaic = GROUP_MOSAIC[groupKey] ?? FALLBACK_MOSAIC;
  // 같은 대분류 안에서도 과목마다 색 순서를 돌려 서로 다르게 보이게 한다.
  const rotated = mosaic.map((_, i) => mosaic[(i + (seed % mosaic.length)) % mosaic.length]);

  const { big, roman } = glyphOf(label);
  const titleLines = splitTitle(title);
  const clipId = `mxc-${seed.toString(36)}`;

  // 모자이크: 글자를 덮는 격자를 삼각형 둘로 쪼개 칠한다. 카드가 작아 성글게 잡는다.
  const GX = 14, GY = 152, GW = 176, GH = 158;
  const COLS = 5, ROWS = 5;
  const cw = GW / COLS, ch = GH / ROWS;
  const tris: { pts: string; fill: string }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GX + c * cw;
      const y = GY + r * ch;
      const flip = rand() > 0.5;
      const a = flip
        ? [`${x},${y}`, `${x + cw},${y}`, `${x},${y + ch}`]
        : [`${x},${y}`, `${x + cw},${y}`, `${x + cw},${y + ch}`];
      const b = flip
        ? [`${x + cw},${y}`, `${x + cw},${y + ch}`, `${x},${y + ch}`]
        : [`${x},${y}`, `${x + cw},${y + ch}`, `${x},${y + ch}`];
      tris.push({ pts: a.join(" "), fill: rotated[Math.floor(rand() * rotated.length)] });
      tris.push({ pts: b.join(" "), fill: rotated[Math.floor(rand() * rotated.length)] });
    }
  }

  // 구멍 두 개 — 과목마다 조금씩 다른 자리에 뚫는다.
  const holeTop = 92 + Math.floor(rand() * 20);
  const holeGap = 176 + Math.floor(rand() * 20);

  return (
    <svg
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="img"
      aria-label={`${title} ${label ?? ""} 표지`}
      style={{ display: "block" }}
    >
      <rect width="300" height="400" fill={paper} />

      {/* 봉투 윗면 접힘 */}
      <path d={`M0 0 H300 V34 L150 58 L0 34 Z`} fill={flap} />
      <path d={`M0 34 L150 58 L300 34`} fill="none" stroke={shade(paper, -0.16)} strokeWidth="1.2" />

      {/* 끈 거는 구멍(흰 도넛) — 왼쪽 가장자리에 걸치게 */}
      {[holeTop, holeTop + holeGap].map((cy, i) => (
        <g key={i}>
          <circle cx="18" cy={cy} r="40" fill="#FFFFFF" />
          <circle cx="18" cy={cy} r="13" fill={paper} />
        </g>
      ))}

      {/* 과목 글자 + 삼각 모자이크 */}
      <defs>
        <clipPath id={clipId}>
          <text
            x="14"
            y="296"
            fontSize="172"
            fontWeight="900"
            letterSpacing="-6"
            style={{ fontFamily: "inherit" }}
          >
            {big}
          </text>
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={GX} y={GY} width={GW} height={GH} fill={rotated[0]} />
        {tris.map((t, i) => (
          <polygon key={i} points={t.pts} fill={t.fill} />
        ))}
      </g>
      {roman && (
        <text x="196" y="302" fontSize="30" fontWeight="800" fill="#FFFFFF" opacity="0.92">
          {roman}
        </text>
      )}

      {/* 오른쪽 세로줄 — 머리말 / 회차 / 상세 */}
      <g fill="#FFFFFF" textAnchor="end" style={{ fontFamily: "inherit" }}>
        <text x="276" y="84" fontSize="8" letterSpacing="1.6" opacity="0.9">
          STADY 기출 모의고사
        </text>
        {titleLines.map((line, i) => (
          <text
            key={i}
            x="276"
            y={110 + i * 23}
            fontSize={line.length > 9 ? 17 : 20}
            fontWeight="800"
            letterSpacing="-0.5"
          >
            {line}
          </text>
        ))}

        <text x="276" y={196} fontSize="8.5" letterSpacing="2.4" opacity="0.95">
          {year ?? ""}
        </text>
        <text x="276" y={212} fontSize="8.5" letterSpacing="2.4" opacity="0.95">
          {month != null ? `${String(month).padStart(2, "0")} MONTH` : ""}
        </text>
        <text x="276" y={228} fontSize="8.5" letterSpacing="2.4" opacity="0.7">
          ×
        </text>
        <text x="276" y={244} fontSize="9.5" letterSpacing="1.2" fontWeight="700">
          {label ?? ""}
        </text>
        <text x="276" y={260} fontSize="8.5" letterSpacing="2.4" opacity="0.95">
          {pageCount}쪽
        </text>

        {/* 시행 월 숫자 */}
        <text x="282" y="352" fontSize="74" fontWeight="300" letterSpacing="-4" opacity="0.95">
          {month ?? ""}
        </text>
      </g>

      {/* 스타디 로고 — 봉투 색 위에 흰색으로 */}
      <image
        href="/icons/stady-logo.svg"
        x="212"
        y="368"
        width="64"
        height="23"
        preserveAspectRatio="xMaxYMid meet"
        style={{ filter: "brightness(0) invert(1)", opacity: 0.95 }}
      />
    </svg>
  );
}
