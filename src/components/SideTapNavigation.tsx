"use client";

import { useSideTap } from "@/lib/useSideTap";

interface SideTapNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

export default function SideTapNavigation({
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
}: SideTapNavigationProps) {
  // 사용자가 끈 경우(헤더의 "화면 탭 이동" 토글) 양옆 탭 영역을 아예 그리지 않는다 — 복사·해설 읽기 중 오작동 방지.
  const [enabled] = useSideTap();
  if (!enabled) return null;
  return (
    <div
      className="side-tap-nav"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        display: "flex",
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="이전 문제"
        onClick={onPrev}
        disabled={prevDisabled}
        className="side-tap-nav__zone"
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          cursor: prevDisabled ? "default" : "pointer",
          pointerEvents: prevDisabled ? "none" : "auto",
          touchAction: "manipulation",
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="다음 문제"
        onClick={onNext}
        disabled={nextDisabled}
        className="side-tap-nav__zone"
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          cursor: nextDisabled ? "default" : "pointer",
          pointerEvents: nextDisabled ? "none" : "auto",
          touchAction: "manipulation",
        }}
      />
      <style>{`
        .side-tap-nav__zone {
          transition: background-color 0.12s ease;
        }
        .side-tap-nav__zone:active {
          background-color: rgba(17, 24, 39, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
