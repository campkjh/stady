"use client";

// 토스 커뮤니티식 액션 아이콘(프리티풀 TossIcons 와 같은 선 그림) — 색은 currentColor.
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  return String(n);
}
export function TossHeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M12 20.2s-7.6-4.5-7.6-10.1A4.35 4.35 0 0 1 12 7.4a4.35 4.35 0 0 1 7.6 2.7c0 5.6-7.6 10.1-7.6 10.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function TossCommentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M12 4.3c4.4 0 7.9 3.2 7.9 7.2s-3.5 7.2-7.9 7.2c-1 0-2-.2-2.9-.5L5 19.6l1.1-3.3C4.9 15 4.1 13.3 4.1 11.5c0-4 3.5-7.2 7.9-7.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function TossRepostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M16.2 4.6 18.8 7.2l-2.6 2.6M18.6 7.2H8.3A3.3 3.3 0 0 0 5 10.5v1M7.8 19.4 5.2 16.8l2.6-2.6M5.4 16.8h10.3a3.3 3.3 0 0 0 3.3-3.3v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function TossShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <circle cx="17.5" cy="5.8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6.5" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="18.2" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.6 10.8 6.8-3.8M8.6 13.2l6.8 3.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ReplyArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M5 4.5v6.2a3.3 3.3 0 0 0 3.3 3.3H19m0 0-3.6-3.6M19 14l-3.6 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function SortArrowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M8 19V5m0 0L4.8 8.2M8 5l3.2 3.2M16 5v14m0 0-3.2-3.2M16 19l3.2-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function SendUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </svg>
  );
}
