// 스타디 프라임 잔여 기간 표시용 공용 헬퍼.
// 만료일이 없는 경우(답변왕 유지 중 무료)는 기간 대신 '유지 조건'을 알린다.

/** 남은 일수(올림). 만료일이 없거나 이상하면 null. */
export function primeDaysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

/** 배너 pill 처럼 좁은 자리에 쓰는 짧은 라벨. */
export function primeRemainingShort(
  expiresAt: string | null | undefined,
  source?: string | null
): string {
  if (source === "answer_king") return "답변왕 유지 중";
  const d = primeDaysLeft(expiresAt);
  if (d === null) return "이용 중";
  if (d <= 0) return "오늘 만료";
  return `${d}일 남음`;
}
