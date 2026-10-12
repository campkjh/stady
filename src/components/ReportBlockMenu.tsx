"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useModalExit } from "@/lib/useModalExit";

// 커뮤니티 신고·차단 메뉴 (App Store 가이드라인 1.2 — UGC 앱 필수 요건).
//  · 신고: 사유를 골라 접수하면 운영자 화면(관리자 > 신고)에 쌓인다.
//  · 차단: 그 사용자의 글·댓글이 "차단한 사람 화면에서만" 사라진다(단방향, 상대는 모름).
// 자기 글/댓글에는 뜨지 않는다. 비로그인 상태에서 누르면 로그인 안내를 준다.

const REASONS = [
  "스팸/광고",
  "욕설/비방",
  "음란물/선정성",
  "혐오 발언",
  "개인정보 노출",
  "기타",
];

type Step = "menu" | "reason" | "blockConfirm" | "done";

interface Props {
  targetType: "post" | "comment";
  postId?: string;
  commentId?: string;
  targetUserId: string | null | undefined;
  targetNickname: string;
  currentUserId: string | null;
  /** 차단이 끝난 뒤 목록/본문을 다시 불러오도록 부모에게 알린다. */
  onBlocked?: () => void;
  /** 댓글 줄에서는 작은 아이콘만, 글 본문에서는 조금 크게. */
  compact?: boolean;
  /** "dots" 는 우측 상단 ⋯ 버튼(글 카드용), 기본은 "신고" 텍스트(댓글 줄용). */
  variant?: "text" | "dots";
}

export default function ReportBlockMenu({
  targetType,
  postId,
  commentId,
  targetUserId,
  targetNickname,
  currentUserId,
  onBlocked,
  compact = false,
  variant = "text",
}: Props) {
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { leaving, exit } = useModalExit();
  useBodyScrollLock(!!step);

  // 내 글/댓글이거나 작성자를 알 수 없으면(탈퇴 등) 메뉴 자체를 숨긴다.
  if (!targetUserId || (currentUserId && currentUserId === targetUserId)) return null;

  function close() {
    setStep(null);
    setBusy(false);
  }

  function openMenu() {
    if (!currentUserId) {
      setMessage("로그인 후 이용할 수 있어요.");
      setStep("done");
      return;
    }
    setStep("menu");
  }

  async function submitReport(reason: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/community/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, postId, commentId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? "신고가 접수되었어요. 확인 후 조치할게요." : data.error || "신고를 접수하지 못했어요.");
    } catch {
      setMessage("네트워크 오류로 신고하지 못했어요.");
    } finally {
      setBusy(false);
      setStep("done");
    }
  }

  async function submitBlock() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/community/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(`${targetNickname}님을 차단했어요. 이 사용자의 글과 댓글이 더 이상 보이지 않아요.`);
        onBlocked?.();
      } else {
        setMessage(data.error || "차단하지 못했어요.");
      }
    } catch {
      setMessage("네트워크 오류로 차단하지 못했어요.");
    } finally {
      setBusy(false);
      setStep("done");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        aria-label={`${targetNickname}님의 ${targetType === "post" ? "글" : "댓글"} 신고 또는 차단`}
        style={
          variant === "dots"
            ? {
                // 글 카드 우측 상단의 점 3개. 글자(⋯)로 그리면 그 글리프가 없는
                // 안드로이드 기기에서 통째로 안 보인다 → SVG 로 그린다.
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--c-text-4c)",
                lineHeight: 0,
                padding: "6px 4px",
                marginRight: -4,
                display: "inline-flex",
                alignItems: "center",
              }
            : {
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--c-text-4c)",
                fontSize: compact ? 12.5 : 13,
                fontWeight: 700,
                padding: compact ? "4px 2px" : "4px 6px",
                lineHeight: 1,
              }
        }
      >
        {variant === "dots" ? (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="4" cy="10" r="1.7" fill="currentColor" />
            <circle cx="10" cy="10" r="1.7" fill="currentColor" />
            <circle cx="16" cy="10" r="1.7" fill="currentColor" />
          </svg>
        ) : (
          "신고"
        )}
      </button>

      {step && (
        <div role="dialog" aria-modal="true" className={`mdl-root is-sheet${leaving ? " is-leaving" : ""}`} style={{ zIndex: 600 }}>
          <div className="mdl-dim" onClick={() => exit(close)} />
          <div className="mdl-sheet" style={{ maxWidth: 480 }}>
            <div className="mdl-handle" />
            <div className="mdl-scroll mdl-list" style={{ padding: "18px 16px 16px" }}>
              {step === "menu" && (
                <>
                  <SheetTitle text={`${targetNickname}님의 ${targetType === "post" ? "게시글" : "댓글"}`} />
                  <SheetItem label="신고하기" onClick={() => setStep("reason")} />
                  <SheetItem label="이 사용자 차단하기" onClick={() => setStep("blockConfirm")} />
                  <SheetItem label="취소" muted onClick={() => exit(close)} />
                </>
              )}

              {step === "reason" && (
                <>
                  <SheetTitle text="신고 사유를 선택해 주세요" />
                  {REASONS.map((reason) => (
                    <SheetItem key={reason} label={reason} disabled={busy} onClick={() => submitReport(reason)} />
                  ))}
                  <SheetItem label="취소" muted onClick={() => exit(close)} />
                </>
              )}

              {step === "blockConfirm" && (
                <>
                  <SheetTitle text={`${targetNickname}님을 차단할까요?`} />
                  <p className="mdl-body is-sm" style={{ margin: "0 0 14px", textAlign: "center" }}>
                    차단하면 이 사용자의 글과 댓글이 보이지 않아요.
                    <br />
                    차단은 상대에게 알려지지 않고, 마이페이지에서 해제할 수 있어요.
                  </p>
                  <SheetItem label={busy ? "처리 중…" : "차단하기"} danger disabled={busy} onClick={submitBlock} />
                  <SheetItem label="취소" muted onClick={() => exit(close)} />
                </>
              )}

              {step === "done" && (
                <>
                  <SheetTitle text={message} />
                  <SheetItem label="확인" main onClick={() => exit(close)} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetTitle({ text }: { text: string }) {
  return (
    <p className="mdl-title" style={{ margin: "0 0 16px", textAlign: "center", fontSize: 19 }}>
      {text}
    </p>
  );
}

function SheetItem({
  label,
  onClick,
  danger,
  muted,
  main,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
  main?: boolean;
  disabled?: boolean;
}) {
  if (muted) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="mdl-textbtn is-muted" style={{ display: "block", margin: "2px auto 0" }}>
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mdl-btn ${danger ? "is-danger" : main ? "is-main" : "is-sub"}`}
      style={{ display: "block", flex: "none", width: "100%", marginBottom: 8 }}
    >
      {label}
    </button>
  );
}
