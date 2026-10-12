"use client";

import { useEffect, type ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useModalExit } from "@/lib/useModalExit";

/*
 * 스타디 알럿·컨펌 — 디자인 시안(Kind=Alert / Kind=Confirm). 스타일은 globals 의 공용 모달(.mdl-*)을 쓴다.
 *  · 버튼 1개 = Alert : 카드 오른쪽 아래에 파란 글씨만 있는 버튼
 *  · 버튼 2개 = Confirm: 왼쪽 회색(취소), 오른쪽 파랑(확인) — 높이 56 · 반경 17 · 글자 17(사장 지정)
 *  · 버튼 3개 이상은 위에서부터 꽉 찬 폭으로 쌓는다(첫 번째가 파랑)
 *
 * buttons 는 예전 호출부와 같은 규칙이다: **첫 번째가 주요 동작**(오른쪽 파랑), 두 번째가 취소(왼쪽 회색).
 * 첫 버튼에 bgColor 를 주면(예: 삭제=빨강) 위험 색일 때만 빨강, 그 외는 시안 파랑으로 통일한다.
 */

interface AlertButton {
  label: string;
  color?: string;
  bgColor?: string;
  onClick: () => void;
}

interface AlertModalProps {
  title: string;
  subtitle?: ReactNode;
  buttons: AlertButton[];
  onClose?: () => void;
}

/** 위험 동작(삭제 등)으로 보고 빨강을 살릴 색인지 */
function isDanger(bg?: string) {
  return !!bg && /danger|ef4444|e85d5d|e5484d|f26b6b|red/i.test(bg);
}

export default function AlertModal({ title, subtitle, buttons, onClose }: AlertModalProps) {
  // 뒤 화면 스크롤 잠금 + 닫을 때 '뚝' 사라지지 않고 내려가는 연출(프리티풀 모달 인터랙션)
  useBodyScrollLock(true);
  const { leaving, exit } = useModalExit();
  const close = onClose ? () => exit(onClose) : undefined;
  const press = (fn: () => void) => () => exit(fn);

  useEffect(() => {
    if (!close) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hasBody = subtitle != null && subtitle !== "";
  const [primary, secondary] = buttons;
  const mainClass = (btn: AlertButton) => `mdl-btn ${isDanger(btn.bgColor) ? "is-danger" : "is-main"}`;

  return (
    <div className={`mdl-root${leaving ? " is-leaving" : ""}`} role="presentation">
      <div className="mdl-dim" onClick={close} />
      <div className="mdl-card" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="mdl-text">
          <h2 className="mdl-title" style={{ whiteSpace: "pre-line" }}>{title}</h2>
          {hasBody && <p className="mdl-body" style={{ whiteSpace: "pre-line" }}>{subtitle}</p>}
        </div>

        {buttons.length === 1 && (
          <div className="mdl-textrow">
            <button type="button" className="mdl-textbtn" onClick={press(primary.onClick)}>
              {primary.label}
            </button>
          </div>
        )}

        {buttons.length === 2 && (
          <div className="mdl-actions">
            <button type="button" className="mdl-btn is-sub" onClick={press(secondary.onClick)}>
              {secondary.label}
            </button>
            <button type="button" className={mainClass(primary)} onClick={press(primary.onClick)}>
              {primary.label}
            </button>
          </div>
        )}

        {buttons.length > 2 && (
          <div className="mdl-actions is-stack">
            {buttons.map((btn, idx) => (
              <button
                key={idx}
                type="button"
                className={idx === 0 ? mainClass(btn) : "mdl-btn is-sub"}
                style={idx === 0 ? { order: -1 } : undefined}
                onClick={press(btn.onClick)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
