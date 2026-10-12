"use client";

import { useEffect, type ReactNode } from "react";

/*
 * 스타디 알럿·컨펌 — 디자인 시안(Kind=Alert / Kind=Confirm)을 그대로 옮겼다.
 *  · 흰 카드 반경 24 · 최대 폭 311 · 제목 20 굵게 + 설명 17 · 좌우 여백 22
 *  · 버튼 1개 = Alert : 카드 오른쪽 아래에 파란 글씨만 있는 버튼(#2272EB)
 *  · 버튼 2개 = Confirm: 높이 48 · 반경 14 · 간격 8 — 왼쪽 회색(취소), 오른쪽 파랑(#3182F6, 확인)
 *  · 버튼 3개 이상은 위에서부터 꽉 찬 폭으로 쌓는다(첫 번째가 파랑)
 *
 * 버튼 규격(사장 지정): 높이 56 · 반경 17 · 글자 17. 확인(2버튼)·알럿(1버튼) 모두 같다.
 *
 * buttons 는 예전 호출부와 같은 규칙이다: **첫 번째가 주요 동작**(오른쪽 파랑), 두 번째가 취소(왼쪽 회색).
 * 첫 버튼에 bgColor 를 주면(예: 삭제=빨강) 그 색을 쓰고, 파랑 계열 기본값이면 시안 파랑으로 통일한다.
 * 색을 지정하지 않은 호출부는 전부 시안 색으로 나온다.
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
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasBody = subtitle != null && subtitle !== "";
  const single = buttons.length === 1;
  const pair = buttons.length === 2;
  const [primary, secondary] = buttons;
  const primaryBg = isDanger(primary?.bgColor) ? "var(--dlg-danger)" : "var(--dlg-confirm)";

  return (
    <div className="dlg-root" role="presentation">
      <div className="dlg-dim" onClick={onClose} />
      <div className="dlg-card" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="dlg-text">
          <h2 className="dlg-title">{title}</h2>
          {hasBody && <p className="dlg-body">{subtitle}</p>}
        </div>

        {single && (
          <div className="dlg-alert-row">
            <button type="button" className="dlg-textbtn" onClick={primary.onClick}>
              {primary.label}
            </button>
          </div>
        )}

        {pair && (
          <div className="dlg-confirm-row">
            <button type="button" className="dlg-btn dlg-btn-sub" onClick={secondary.onClick}>
              {secondary.label}
            </button>
            <button
              type="button"
              className="dlg-btn dlg-btn-main"
              style={{ background: primaryBg }}
              onClick={primary.onClick}
            >
              {primary.label}
            </button>
          </div>
        )}

        {buttons.length > 2 && (
          <div className="dlg-confirm-row is-stack">
            {buttons.map((btn, idx) => (
              <button
                key={idx}
                type="button"
                className={`dlg-btn ${idx === 0 ? "dlg-btn-main" : "dlg-btn-sub"}`}
                style={idx === 0 ? { background: isDanger(btn.bgColor) ? "var(--dlg-danger)" : "var(--dlg-confirm)" } : undefined}
                onClick={btn.onClick}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .dlg-root {
          --dlg-card: #FFFFFF;
          --dlg-title: rgba(0, 12, 30, 0.8);
          --dlg-bodyc: rgba(3, 18, 40, 0.7);
          --dlg-alert: #2272EB;
          --dlg-confirm: #3182F6;
          --dlg-danger: #F04452;
          --dlg-sub-bg: rgba(7, 25, 76, 0.05);
          --dlg-sub-fg: rgba(2, 32, 71, 0.65);
          position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 500;
          display: flex; align-items: center; justify-content: center; padding: 0 24px;
        }
        [data-theme="dark"] .dlg-root {
          --dlg-card: #26272E;
          --dlg-title: rgba(255, 255, 255, 0.92);
          --dlg-bodyc: rgba(255, 255, 255, 0.66);
          --dlg-alert: #6FA8FF;
          --dlg-confirm: #3C8AFF;
          --dlg-danger: #F25A66;
          --dlg-sub-bg: rgba(255, 255, 255, 0.09);
          --dlg-sub-fg: rgba(255, 255, 255, 0.72);
        }
        .dlg-dim { position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: rgba(0, 0, 0, 0.5); animation: dlgFade 0.2s ease-out both; }
        .dlg-card {
          position: relative; width: 100%; max-width: 311px; box-sizing: border-box;
          background: var(--dlg-card); border-radius: 24px; overflow: hidden;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
          animation: dlgPop 0.32s cubic-bezier(0.2, 1.2, 0.3, 1) both;
        }
        .dlg-text { padding: 24px 22px 0; }
        .dlg-title { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.4; letter-spacing: -0.4px; color: var(--dlg-title); white-space: pre-line; word-break: keep-all; }
        .dlg-body { margin: 6px 0 0; font-size: 17px; font-weight: 400; line-height: 1.5; letter-spacing: -0.3px; color: var(--dlg-bodyc); white-space: pre-line; word-break: keep-all; }
        .dlg-alert-row { display: flex; justify-content: flex-end; padding: 8px 12px 10px; }
        .dlg-textbtn {
          height: 56px; padding: 0 18px; border: 0; background: transparent; border-radius: 17px; cursor: pointer;
          font-size: 17px; font-weight: 700; letter-spacing: -0.3px; color: var(--dlg-alert);
          -webkit-tap-highlight-color: transparent; transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s;
        }
        .dlg-textbtn:active { transform: scale(0.94); background: rgba(34, 114, 235, 0.08); }
        .dlg-confirm-row { display: flex; gap: 8px; padding: 24px 16px 16px; }
        .dlg-confirm-row.is-stack { flex-direction: column; }
        .dlg-btn {
          flex: 1 1 0; min-width: 0; height: 56px; border: 0; border-radius: 17px; cursor: pointer;
          font-size: 17px; font-weight: 700; letter-spacing: -0.3px;
          -webkit-tap-highlight-color: transparent; transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), filter 0.2s;
        }
        .dlg-btn:active { transform: scale(0.96); filter: brightness(0.94); }
        .dlg-btn-sub { background: var(--dlg-sub-bg); color: var(--dlg-sub-fg); }
        .dlg-btn-main { background: var(--dlg-confirm); color: #fff; }
        .dlg-confirm-row.is-stack .dlg-btn-main { order: -1; }
        @keyframes dlgFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dlgPop { from { opacity: 0; transform: translateY(14px) scale(0.94); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .dlg-dim, .dlg-card { animation: none !important; } }
      `}</style>
    </div>
  );
}
