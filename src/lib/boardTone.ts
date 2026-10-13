// 게시판별 배지 색(아바타에 겹치는 알약) — 사장 지정 팔레트(파랑·회색·빨강·주황·노랑·초록)의 살짝 번지는 그라데이션.
// 정해진 게시판은 고정색, 새 게시판은 이름으로 팔레트에서 골라 늘 같은 색이 나온다. 밝은 색(노랑·회색)은 글자를 어둡게.
export interface BoardTone { bg: string; color: string; to: string }
const mk = (from: string, to: string, color = "#fff"): BoardTone => ({ bg: `linear-gradient(135deg, ${from}, ${to})`, color, to });
const TONE_BLUE = mk("#5a90f3", "#5087f0");
const TONE_GRAY = mk("#b7bdc3", "#adb4bb", "#4e5968");
const TONE_RED = mk("#e6767b", "#e56e73");
const TONE_ORANGE = mk("#f3b14e", "#f3af49");
const TONE_YELLOW = mk("#f8d575", "#f7d372", "#6b5300");
const TONE_GREEN = mk("#77d4a5", "#74d2a2");
const BOARD_TONES: Record<string, BoardTone> = {
  자유: TONE_BLUE,
  입시: TONE_GREEN,
  질문: TONE_ORANGE,
  공지: TONE_RED,
};
const BOARD_FALLBACK_TONES = [TONE_YELLOW, TONE_GRAY, TONE_GREEN, TONE_BLUE];
export function boardTone(groupName: string): BoardTone {
  const key = groupName.replace(/게시판$/, "") || groupName;
  if (BOARD_TONES[key]) return BOARD_TONES[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return BOARD_FALLBACK_TONES[h % BOARD_FALLBACK_TONES.length];
}


/** 게시판 이름에서 '게시판'을 뗀 짧은 이름("질문게시판" → "질문"). */
export function boardShortName(groupName: string): string {
  return groupName.replace(/게시판$/, "") || groupName;
}
