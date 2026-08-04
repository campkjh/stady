// 커뮤니티 글쓰기 말풍선 넛지("하루에 한번 커뮤니티 글 쓰기").
// 오늘 글을 쓴 사람에게는 같은 날 다시 띄우지 않는다. 기준일은 한국 시간.

export const WRITE_NUDGE_KEY = "community-write-nudge-day";

// KST 기준 YYYY-MM-DD (sv-SE 로케일이 ISO 형식으로 떨어진다).
export function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

// 글 등록 성공 시 호출 — 오늘은 넛지를 숨긴다.
export function markWroteToday(): void {
  try {
    localStorage.setItem(WRITE_NUDGE_KEY, todayKey());
  } catch {
    // 프라이빗 모드 등에서 저장이 막히면 그냥 넛지가 계속 보일 뿐이라 무시.
  }
}
