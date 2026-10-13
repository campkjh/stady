"use client";

import { useSideTap } from "@/lib/useSideTap";

/**
 * 퀴즈 헤더의 "양옆 화면 탭으로 넘기기" 켜기/끄기 버튼.
 * 켜짐 = 파란 강조, 꺼짐 = 회색 + 빗금. 누르면 바로 바뀌고 onChange 로 안내 문구를 띄울 수 있다.
 */
export default function SideTapToggle({
  onChange,
  size = 32,
  bare = false,
}: {
  onChange?: (on: boolean) => void;
  size?: number;
  /** 테두리·배경 없는 아이콘 버튼(헤더 모양이 다른 화면용) */
  bare?: boolean;
}) {
  const [on, setOn] = useSideTap();
  const label = on ? "양옆 화면 탭으로 넘기기 끄기" : "양옆 화면 탭으로 넘기기 켜기";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      className="press"
      onClick={() => {
        setOn(!on);
        onChange?.(!on);
      }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: 10, flexShrink: 0, cursor: "pointer", padding: 0,
        border: bare ? "none" : `1px solid ${on ? "transparent" : "var(--c-bg-muted-8)"}`,
        background: bare ? "none" : on ? "var(--c-brand-soft-3)" : "var(--c-bg)",
        color: on ? "var(--c-brand)" : "var(--c-text-4b)",
        transition: "background 0.16s ease, color 0.16s ease",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <polyline points="9.5 9 7 12 9.5 15" />
        <polyline points="14.5 9 17 12 14.5 15" />
        {!on && (
          <>
            <line x1="4" y1="3" x2="20" y2="21" stroke="var(--c-bg)" strokeWidth="5" />
            <line x1="4" y1="3" x2="20" y2="21" />
          </>
        )}
      </svg>
    </button>
  );
}
