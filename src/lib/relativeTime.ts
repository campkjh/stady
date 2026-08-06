// 커뮤니티 시간 표기: 방금 / N분 전 / N시간 전 / N일 전.
// 일주일이 넘으면 상대시간이 오히려 감이 안 와서 날짜로 바꾼다(올해면 "8월 4일").

export function formatRelativeTime(input: string | Date, now: number = Date.now()): string {
  const t = new Date(input).getTime();
  if (!Number.isFinite(t)) return "";

  const diff = now - t;
  // 서버·기기 시계 차이로 미래로 찍히면 '방금'으로 본다.
  if (diff < 60_000) return "방금";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  const d = new Date(t);
  return d.getFullYear() === new Date(now).getFullYear()
    ? `${d.getMonth() + 1}월 ${d.getDate()}일`
    : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// 상대시간 옆에 붙일 정확한 시각(title 속성용 — 길게 누르거나 hover하면 보인다).
export function formatExactTime(input: string | Date): string {
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("ko-KR") : "";
}
