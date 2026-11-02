"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canShareFile, fetchPdfFile, isAndroidWebView, savePdfFile } from "@/lib/pdfSave";

// 원본 시험지/해설 PDF 받기 버튼(인쇄·한 번에 보기용) — 모의고사 뷰어 상단바·수능대비자료 카드.
// 누르면 작은 메뉴가 뜨고, 고르면 PDF 를 받아 둔 뒤 [저장·인쇄하기] 로 공유 시트를 연다
// (공유 시트는 누른 순간에만 열려서 두 번 누르게 한다 — lib/pdfSave.ts 참고).
// 메뉴는 body 로 띄운다(카드 목록처럼 스크롤 칸 안에 있어도 잘리지 않게).

type Kind = "problem" | "solution";
type Prep =
  | { kind: Kind; status: "loading" }
  | { kind: Kind; status: "ready"; file: File }
  | { kind: Kind; status: "error"; message: string };

const LABEL: Record<Kind, string> = { problem: "시험지 PDF", solution: "해설 PDF" };

// 위로 열 때는 버튼 위쪽 끝에 붙인다(translateY(-100%)). 뷰어의 .mock-section-menu 애니메이션은 가운데 정렬용이라 따로 둔다.
const PDFB_MENU_CSS = `
  .pdfb-menu { transform-origin: top right; animation: pdfbIn 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
  .pdfb-menu.is-up { transform: translateY(-100%); transform-origin: bottom right; animation-name: pdfbInUp; }
  @keyframes pdfbIn { from { opacity: 0; transform: translateY(-8px) scale(0.94); } to { opacity: 1; transform: none; } }
  @keyframes pdfbInUp { from { opacity: 0; transform: translateY(calc(-100% + 8px)) scale(0.94); } to { opacity: 1; transform: translateY(-100%); } }
  @media (prefers-reduced-motion: reduce) { .pdfb-menu { animation: none; } }
`;

export default function MockExamPdfButton({
  apiBase,
  title,
  subtitle,
  has,
  buttonStyle,
  iconColor = "#fff",
  labels = LABEL,
  onBlocked,
}: {
  /** PDF 받는 API 주소(뒤에 kind 를 붙인다) */
  apiBase: string;
  title: string;
  subtitle: string | null;
  has: { problem: boolean; solution: boolean };
  buttonStyle: CSSProperties;
  iconColor?: string;
  labels?: Record<Kind, string>;
  /** 받을 수 없는 사람(비로그인·미구독)이 누르면 메뉴 대신 이걸 부른다 */
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [done, setDone] = useState("");
  const reqRef = useRef(0);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(""), 2200);
    return () => clearTimeout(t);
  }, [done]);

  const apiUrl = (kind: Kind) => `${apiBase}${apiBase.includes("?") ? "&" : "?"}kind=${kind}`;
  const fileName = (kind: Kind) =>
    `${[title, subtitle].filter(Boolean).join(" ")}${kind === "solution" ? " 해설" : ""}.pdf`.replace(/[\\/:*?"<>|]/g, " ");

  function toggle() {
    if (open) { close(); return; }
    if (onBlocked) { onBlocked(); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      // 아래 자리가 모자라면 위로 연다(메뉴 높이 ≈ 200).
      const up = window.innerHeight - r.bottom < 220 && r.top > 220;
      setPos({ top: up ? r.top - 6 : r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), up });
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setPrep(null);
    reqRef.current++;
  }

  async function choose(kind: Kind) {
    // 안드로이드 앱 WebView 는 공유·blob 저장이 막혀 있어 다운로드 주소로 보낸다(앱이 받아 준다).
    if (isAndroidWebView()) {
      close();
      window.location.assign(apiUrl(kind));
      return;
    }
    const req = ++reqRef.current;
    setPrep({ kind, status: "loading" });
    try {
      const file = await fetchPdfFile(apiUrl(kind), fileName(kind));
      if (req !== reqRef.current) return;
      // 공유 시트를 쓰지 않는 환경(데스크톱)은 바로 저장한다.
      if (!canShareFile(file)) {
        await savePdfFile(file);
        close();
        setDone("PDF를 저장했어요");
        return;
      }
      setPrep({ kind, status: "ready", file });
    } catch (e) {
      if (req !== reqRef.current) return;
      setPrep({ kind, status: "error", message: e instanceof Error ? e.message : "PDF를 받지 못했어요." });
    }
  }

  async function share(file: File) {
    const r = await savePdfFile(file);
    if (r === "cancelled") return;
    close();
    if (r === "downloaded") setDone("PDF를 저장했어요");
  }

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        aria-label="PDF 받기"
        title="PDF 받기(인쇄·한 번에 보기)"
        aria-expanded={open}
        style={{ ...buttonStyle, background: open ? "rgba(255,255,255,0.14)" : (buttonStyle.background as string | undefined) }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: iconColor }} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11" />
          <polyline points="7 10.5 12 15.5 17 10.5" />
          <path d="M5 19.5h14" />
        </svg>
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={close} style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 399 }} />
          <div
            className={`pdfb-menu${pos.up ? " is-up" : ""}`}
            role="menu"
            style={{
              position: "fixed", top: pos.top, right: pos.right, zIndex: 400,
              width: 220, background: "var(--c-bg)", borderRadius: 14, padding: 6,
              border: "1px solid var(--c-border, rgba(0,0,0,0.08))", boxShadow: "0 16px 40px rgba(15,23,42,0.28)",
            }}
          >
            <style>{PDFB_MENU_CSS}</style>
            <p style={{ margin: "6px 10px 6px", fontSize: 12, fontWeight: 600, color: "var(--c-text-4)", lineHeight: 1.45 }}>
              원본 PDF로 인쇄하거나 한 번에 볼 수 있어요
            </p>
            {(["problem", "solution"] as const).map((kind) => {
              const available = has[kind];
              const mine = prep?.kind === kind ? prep : null;
              return (
                <div key={kind}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!available || mine?.status === "loading"}
                    onClick={() => choose(kind)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "10px 12px", borderRadius: 10, border: "none",
                      cursor: available ? "pointer" : "default",
                      background: mine ? "var(--c-bg-muted-4)" : "transparent",
                      color: available ? "var(--c-text-b)" : "var(--c-text-5)",
                      fontSize: 14, fontWeight: 600, textAlign: "left", fontFamily: "inherit",
                    }}
                  >
                    {labels[kind]}
                    <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--c-text-5)" }}>
                      {!available ? "없음" : mine?.status === "loading" ? "받는 중…" : ""}
                    </span>
                  </button>
                  {mine?.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => share(mine.file)}
                      style={{
                        display: "block", width: "calc(100% - 12px)", margin: "4px 6px 6px", height: 42,
                        borderRadius: 12, border: "none", background: "#3182f6", color: "#fff",
                        fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      저장·인쇄하기
                    </button>
                  )}
                  {mine?.status === "error" && (
                    <p style={{ margin: "2px 12px 8px", fontSize: 12.5, fontWeight: 600, color: "var(--c-danger-b, #e8544e)" }}>{mine.message}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>,
        document.body
      )}

      {done && (
        <span
          role="status"
          style={{
            position: "fixed", left: "50%", bottom: "calc(32px + env(safe-area-inset-bottom, 0px))", transform: "translateX(-50%)",
            zIndex: 300, padding: "11px 16px", borderRadius: 12, background: "rgba(25,31,40,0.92)", color: "#fff",
            fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", pointerEvents: "none",
          }}
        >
          {done}
        </span>
      )}
    </span>
  );
}
