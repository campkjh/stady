// 라이트 → 다크 팔레트. apply-theme-vars.mjs 가 이 표 하나로
//   (1) globals.css 의 :root / [data-theme="dark"] 변수 블록을 생성하고
//   (2) src/**/*.tsx + globals.css 의 색 리터럴을 var(--c-<name>) 로 치환한다.
//
// 원칙
//  - 라이트는 픽셀 하나도 안 바뀌어야 하므로 **라이트 hex 1개 = 변수 1개**(같은 역할이면 -2, -3 접미).
//    폴백은 넣지 않고(:root 에 라이트 값을 빠짐없이 정의) var(--c-x) 만 쓴다.
//  - 같은 hex 라도 속성 문맥에 따라 뜻이 다르다(#FFF: 면 vs 글자, #111827: 글자 vs 역상 버튼 면).
//    → SURFACE(면·경계) / TEXT(글자·아이콘) / ACCENT(브랜드·상태, 속성 무관) 3개 표로 나눈다.
//  - 흰 글자(color/fill/stroke 의 #fff)는 파란 버튼·딤 위의 글자라 다크에서도 흰색 → 치환하지 않는다.
//  - 그라디언트 안, 캔버스(strokeStyle/fillStyle), 그림자 rgba 는 건드리지 않는다.

const S = (name, light, dark) => ({ name, light: light.toUpperCase(), dark });

// ── 면 · 경계 (background / backgroundColor / border* / boxShadow / outline / bg:) ──
export const SURFACE = [
  S("bg", "#FFFFFF", "#17171C"),                 // 페이지·카드 기본 배경 (#fff/#FFF/white 도 동일)
  // 연한 회색 면(리스트 배경·입력·구분 띠)
  S("bg-soft", "#F9FAFB", "#1E1E25"),
  S("bg-soft-2", "#FAFBFC", "#1E1E25"),
  S("bg-soft-3", "#FAFAFA", "#1E1E25"),
  S("bg-soft-4", "#F7F9FC", "#1E1E25"),
  S("bg-soft-5", "#F5F7FA", "#1E1E25"),
  S("bg-soft-6", "#F8FAFC", "#1E1E25"),
  S("bg-soft-7", "#F8F9FA", "#1E1E25"),
  S("bg-soft-8", "#F7F8FA", "#1E1E25"),
  S("bg-soft-9", "#FBFCFE", "#1C1C22"),
  S("bg-soft-10", "#FBFCFD", "#1C1C22"),
  S("bg-soft-11", "#F6F8FB", "#1E1E25"),
  S("bg-soft-12", "#F4F6F9", "#1E1E25"),
  S("bg-soft-13", "#F3F5F8", "#1E1E25"),
  S("bg-soft-14", "#F9FBFF", "#1E1E25"),
  // 칩·뱃지·구분 면
  S("bg-muted", "#F3F4F6", "#26262E"),
  S("bg-muted-2", "#F2F4F6", "#26262E"),
  S("bg-muted-3", "#F2F3F5", "#26262E"),
  S("bg-muted-4", "#F1F3F5", "#26262E"),
  S("bg-muted-5", "#F1F4F8", "#26262E"),
  S("bg-muted-6", "#EEF0F3", "#26262E"),
  S("bg-muted-7", "#EEF1F5", "#26262E"),
  S("bg-muted-8", "#EDF0F3", "#26262E"),
  S("bg-muted-9", "#EEF2F7", "#26262E"),
  S("bg-muted-10", "#F5F6F8", "#26262E"),
  S("bg-muted-11", "#F1F5F9", "#26262E"),
  S("bg-muted-12", "#EFF1F4", "#26262E"),
  S("bg-muted-13", "#EBEFF4", "#26262E"),
  S("bg-muted-14", "#EDEFF2", "#26262E"),
  S("bg-muted-15", "#E9ECF1", "#2A2A33"),
  S("bg-muted-16", "#E9EDF3", "#2A2A33"),
  S("bg-muted-17", "#E9ECEF", "#2A2A33"),
  S("bg-muted-18", "#F2F2F6", "#26262E"),
  S("bg-muted-19", "#EEF1F3", "#26262E"),
  S("bg-muted-20", "#E5E8EB", "#2E2E37"),      // 눌림/호버 면
  S("bg-muted-21", "#DFE3E8", "#33333D"),
  S("bg-muted-22", "#D7DCE3", "#33333D"),
  S("bg-muted-23", "#CBD2DA", "#33333D"),
  // 경계
  S("border", "#E5E7EB", "#2C2C35"),
  S("border-strong", "#D1D5DB", "#3D3D48"),
  S("border-strong-2", "#C4CDD8", "#3D3D48"),
  S("border-strong-3", "#AEB6C0", "#3D3D48"),
  S("border-strong-4", "#D8DDE5", "#3D3D48"),
  S("border-strong-5", "#C9D3DF", "#3D3D48"),
  S("border-strong-6", "#9CA3AF", "#4A4F5A"),
  S("border-strong-7", "#6B7280", "#5A5F6A"),
  // 역상(원래 어두운) 면 — 다크에선 살짝 밝은 회색으로 남겨 흰 글자를 유지한다
  S("inverse", "#111827", "#3A3B45"),
  S("inverse-2", "#191F28", "#3A3B45"),
  S("inverse-3", "#111111", "#3A3B45"),
  S("inverse-4", "#1E1F23", "#3A3B45"),
  S("inverse-5", "#292A2E", "#34353C"),        // AlertModal 기본 버튼
  S("inverse-6", "#41444B", "#2A2B31"),        // 모의고사 뷰어 상단바
  // 파랑 연면
  S("brand-soft", "#E8F0FE", "#1B2A44"),
  S("brand-soft-2", "#EBF3FF", "#1B2A44"),
  S("brand-soft-3", "#EEF5FF", "#192538"),
  S("brand-soft-4", "#EFF6FF", "#192538"),
  S("brand-soft-5", "#F0F5FF", "#192538"),
  S("brand-soft-6", "#EAF2FF", "#1B2A44"),
  S("brand-soft-7", "#F2F7FF", "#192538"),
  S("brand-soft-8", "#F4F8FF", "#192538"),
  S("brand-soft-9", "#E9F1FF", "#1B2A44"),
  S("brand-soft-10", "#EBF0FF", "#1B2A44"),
  S("brand-soft-11", "#E4EEFF", "#1B2A44"),
  S("brand-soft-12", "#EAF3FF", "#1B2A44"),
  S("brand-soft-13", "#F0F6FF", "#192538"),
  S("brand-soft-14", "#F3F7FF", "#192538"),
  S("brand-soft-15", "#EEF4FC", "#192538"),
  S("brand-soft-16", "#F2F6FC", "#192538"),
  S("brand-line", "#DEE9FB", "#22345A"),
  S("brand-line-2", "#DBEAFE", "#22345A"),
  S("brand-line-3", "#D6E4FF", "#22345A"),
  S("brand-line-4", "#D3E4FF", "#22345A"),
  S("brand-line-5", "#C4D4F0", "#22345A"),
  S("brand-line-6", "#BFD4F2", "#22345A"),
  S("brand-line-7", "#D9E3F5", "#22345A"),
  S("brand-line-8", "#C8D6EE", "#22345A"),
  S("brand-line-9", "#BFDBFE", "#2A4370"),
  S("brand-line-10", "#93C5FD", "#2A4370"),
  // 빨강 연면
  S("danger-soft", "#FEF2F2", "#33201F"),
  S("danger-soft-2", "#FFE0E0", "#3A2224"),
  S("danger-soft-3", "#FEE2E2", "#3A2224"),
  S("danger-soft-4", "#FFF5F5", "#33201F"),
  S("danger-soft-5", "#FFEFF1", "#33201F"),
  S("danger-soft-6", "#FFE7E7", "#3A2224"),
  S("danger-soft-7", "#FFF1F2", "#33201F"),
  S("danger-line", "#FECACA", "#5A2C2E"),
  S("danger-line-2", "#FCA5A5", "#5A2C2E"),
  S("danger-line-3", "#FBD5D5", "#5A2C2E"),
  S("danger-line-4", "#FFC9CF", "#5A2C2E"),
  // 초록 연면
  S("success-soft", "#ECFDF5", "#12332A"),
  S("success-soft-2", "#F0FDF4", "#12332A"),
  S("success-soft-3", "#E8F5E9", "#12332A"),
  S("success-line", "#D1FAE5", "#1A4536"),
  S("success-line-2", "#A7F3D0", "#1A4536"),
  // 노랑 연면
  S("warn-soft", "#FFFBEB", "#3A2F12"),
  S("warn-soft-2", "#FEF3C7", "#46381A"),
  S("warn-soft-3", "#FFF7E8", "#3A2F12"),
  S("warn-soft-4", "#FFF4E5", "#3A2F12"),
  S("warn-soft-5", "#FFF8B8", "#46381A"),
  S("warn-soft-6", "#FFF6A8", "#46381A"),
  S("warn-line", "#FFE9A8", "#5A4A1E"),
  S("warn-line-2", "#EFE39A", "#5A4A1E"),
  // 보라 연면
  S("purple-soft", "#F5F3FF", "#2A2440"),
  S("purple-soft-2", "#F4F3FB", "#2A2440"),
  S("purple-soft-3", "#F3EFFA", "#2A2440"),
];

// ── 글자 · 아이콘 (color / fill / stroke / WebkitTextFillColor / caretColor / text: / tint:) ──
export const TEXT = [
  S("text", "#111827", "#ECEDF0"),
  S("text-b", "#191F28", "#ECEDF0"),
  S("text-c", "#111111", "#ECEDF0"),
  S("text-d", "#1B1E24", "#ECEDF0"),
  S("text-e", "#26282E", "#ECEDF0"),
  S("text-f", "#171717", "#ECEDF0"),
  S("text-2", "#2B313D", "#CDD0D6"),
  S("text-2b", "#333D4B", "#CDD0D6"),
  S("text-2c", "#374151", "#CDD0D6"),
  S("text-2d", "#4B5563", "#C0C4CB"),
  S("text-2e", "#2E333B", "#CDD0D6"),
  S("text-2f", "#3A3F47", "#CDD0D6"),
  S("text-2g", "#475569", "#C0C4CB"),
  S("text-2h", "#333333", "#CDD0D6"),
  S("text-2i", "#1F2937", "#CDD0D6"),
  S("text-3", "#6B7280", "#A2A7B0"),
  S("text-3b", "#4E5968", "#A2A7B0"),
  S("text-3c", "#51535C", "#A2A7B0"),
  S("text-4", "#8A909C", "#7E848F"),
  S("text-4b", "#8B95A1", "#7E848F"),
  S("text-4c", "#9CA3AF", "#7E848F"),
  S("text-4d", "#94A3B8", "#7E848F"),
  S("text-4e", "#B0B5BD", "#7E848F"),
  S("text-4f", "#B8BCC4", "#7E848F"),
  S("text-4g", "#BDC2CB", "#7E848F"),
  S("text-4h", "#C7CCD5", "#6E747E"),
  S("text-4i", "#C9CDD4", "#6E747E"),
  S("text-5", "#B0B8C1", "#5F646E"),
  S("text-5b", "#C0C0C0", "#5F646E"),
  S("text-5c", "#CCCCCC", "#5F646E"),
  S("text-5d", "#D1D5DB", "#4E535D"),
  S("text-5e", "#B6BCC6", "#5F646E"),
  S("text-5f", "#9BB4DC", "#5F7699"),
  S("text-5g", "#C8D6EE", "#5F7699"),
  S("text-5h", "#C9D3DF", "#5F646E"),
];

// ── 브랜드 · 상태 (속성 무관: 면·글자·경계·인셋 링 어디서든 같은 변수) ──
export const ACCENT = [
  S("brand", "#3787FF", "#4A93FF"),
  S("brand-b", "#3182F6", "#4A93FF"),
  S("brand-deep", "#1F5EDC", "#7FB0FF"),
  S("brand-deep-2", "#1D4ED8", "#7FB0FF"),
  S("brand-deep-3", "#2563EB", "#7FB0FF"),
  S("brand-deep-4", "#1B64DA", "#7FB0FF"),
  S("brand-deep-5", "#2F6BE0", "#7FB0FF"),
  S("brand-deep-6", "#4A6BB0", "#8FB4F0"),
  S("brand-deep-7", "#2E75E3", "#4A93FF"),
  S("correct", "#4A90D9", "#5DA3F0"),
  S("brand-mid", "#7EA6E8", "#7EA6E8"),
  S("brand-mid-2", "#6B7CF7", "#8B9CFF"),
  S("danger", "#EF4444", "#F26B6B"),
  S("danger-b", "#E85D5D", "#F26B6B"),
  S("danger-c", "#DC2626", "#F87171"),
  S("danger-d", "#E11D48", "#FB5C7F"),
  S("danger-e", "#FF3B30", "#FF5F55"),
  S("danger-f", "#FF3B5C", "#FF5F7A"),
  S("danger-g", "#F93052", "#FF5F7A"),
  S("danger-h", "#E5484D", "#F26B6B"),
  S("danger-i", "#E03131", "#F26B6B"),
  S("danger-j", "#C0392B", "#F26B6B"),
  S("danger-k", "#E8453C", "#F26B6B"),
  S("danger-l", "#D93A4E", "#F26B6B"),
  S("danger-deep", "#B91C1C", "#FCA5A5"),
  S("success", "#10B981", "#34D399"),
  S("success-b", "#059669", "#34D399"),
  S("success-c", "#047857", "#34D399"),
  S("success-d", "#065F46", "#6EE7B7"),
  S("success-e", "#16A34A", "#4ADE80"),
  S("success-f", "#4ADE80", "#4ADE80"),
  S("warn", "#F59E0B", "#FBBF24"),
  S("warn-b", "#D97706", "#FBBF24"),
  S("warn-c", "#B26A00", "#FBBF24"),
  S("warn-d", "#B7791F", "#FBBF24"),
  S("warn-e", "#E59500", "#FBBF24"),
  S("warn-f", "#EAB308", "#FACC15"),
  S("warn-g", "#F97316", "#FB923C"),
  S("warn-h", "#FBBF24", "#FBBF24"),
  S("warn-i", "#FFC84D", "#FFC84D"),
  S("warn-deep", "#8A7A3C", "#F5D77A"),   // 노랑 연면 위 진한 글자
  S("warn-deep-2", "#4A4224", "#F5D77A"),
  S("warn-deep-3", "#3A3320", "#F5D77A"),
  S("warn-deep-4", "#8A6A00", "#F5D77A"),
  S("purple", "#8B5CF6", "#A78BFA"),
];

// rgba 계열: 면 문맥의 반투명 흰색(글래스 패널, alpha ≥ 0.5)만 다크 면으로.
// alpha < 0.5 는 파란 카드/딤 위의 흰 오버레이라 그대로 둔다. 딤(rgba(15,23,42|0,0,0,x))·그림자는 그대로.
export const RGBA_SURFACE = [
  { name: "bg-a", light: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+|1(?:\.0)?)\s*\)/g,
    minAlpha: 0.5, dark: (a) => `rgba(23,23,28,${a})` },
  { name: "tint-a", light: /rgba\(\s*7\s*,\s*25\s*,\s*76\s*,\s*(0?\.\d+)\s*\)/g,
    minAlpha: 0, dark: () => "rgba(255,255,255,0.08)" },
];

// 이름 있는 상수 (`const NAME = "#hex"`) — 사용처가 한 역할로 고정된 것만 힌트로 치환.
export const CONST_HINTS = {
  PRIMARY: "accent", PRIMARY_DARK: "accent", primary: "accent",
  PRIMARY_SOFT: "surface", PRIMARY_SOFTER: "surface", ACCENT_BG: "surface", OFFLINE_FILL: "surface",
  TEXT_MUTED: "text", ACTIVE_COLOR: "accent", INACTIVE_COLOR: "text",
};
