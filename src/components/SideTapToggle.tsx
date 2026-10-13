"use client";

import { useSideTap } from "@/lib/useSideTap";
import { TapIcon } from "@/components/icons/ToolIcons";

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
      {/* 손가락 탭 아이콘 — 꺼짐일 땐 빗금을 얹는다 */}
      <span style={{ position: "relative", display: "inline-flex" }}>
        <TapIcon size={20} />
        {!on && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
            <line x1="4" y1="3" x2="20" y2="21" stroke="var(--c-bg)" strokeWidth="5" />
            <line x1="4" y1="3" x2="20" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
