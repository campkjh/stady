"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadFiles, fetchPdfFile, isAndroidWebView, isIosApp, shareFiles } from "@/lib/pdfSave";

// 원본 시험지/해설 PDF 받기 버튼(인쇄·한 번에 보기용) — 모의고사 뷰어 상단바·수능대비자료 카드.
// 누르면 메뉴 없이 있는 PDF(시험지·해설)를 한꺼번에 받는다.
//  · 안드로이드 앱: 다운로드 주소로 차례로 보낸다(앱이 받아 준다).
//  · 아이폰 앱: 다운로드를 못 하는 WebView 라 공유 시트(파일에 저장·인쇄)로 연다. 받는 데 오래 걸려
//    '누른 순간'이 지나 거절되면 [저장·인쇄하기] 한 번만 더 누르게 한다(lib/pdfSave.ts 참고).
//  · 그 밖(데스크톱·브라우저): 받아서 바로 저장.

type Kind = "problem" | "solution";
const KINDS: Kind[] = ["problem", "solution"];

export default function MockExamPdfButton({
  apiBase,
  title,
  subtitle,
  has,
  buttonStyle,
  iconColor = "#fff",
  onBlocked,
  label,
  wrapStyle,
}: {
  /** PDF 받는 API 주소(뒤에 kind 를 붙인다) */
  apiBase: string;
  title: string;
  subtitle: string | null;
  has: { problem: boolean; solution: boolean };
  buttonStyle: CSSProperties;
  iconColor?: string;
  /** 받을 수 없는 사람(비로그인·미구독)이 누르면 받기 대신 이걸 부른다 */
  onBlocked?: () => void;
  /** 있으면 아이콘 옆에 글자를 붙인다(카드 하단 버튼) */
  label?: string;
  wrapStyle?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  // 아이폰 앱에서 공유 시트가 거절됐을 때 다시 누를 파일들.
  const [ready, setReady] = useState<File[] | null>(null);
  const [done, setDone] = useState("");
  // 한 번 받은 파일은 다시 누를 때 재사용한다.
  const filesRef = useRef<File[] | null>(null);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(""), 2200);
    return () => clearTimeout(t);
  }, [done]);

  const apiUrl = (kind: Kind) => `${apiBase}${apiBase.includes("?") ? "&" : "?"}kind=${kind}`;
  const fileName = (kind: Kind) =>
    `${[title, subtitle].filter(Boolean).join(" ")}${kind === "solution" ? " 해설" : ""}.pdf`.replace(/[\\/:*?"<>|]/g, " ");

  async function download() {
    if (busy) return;
    if (onBlocked) { onBlocked(); return; }
    const kinds = KINDS.filter((k) => has[k]);
    if (kinds.length === 0) { setDone("아직 PDF가 없어요"); return; }

    // 안드로이드 앱 WebView 는 공유·blob 저장이 막혀 있어 다운로드 주소로 보낸다(앱이 받아 준다).
    // 바로 이어 보내면 두 번째 이동이 첫 번째를 취소하므로 간격을 둔다.
    if (isAndroidWebView()) {
      kinds.forEach((k, i) => setTimeout(() => window.location.assign(apiUrl(k)), i * 1500));
      setDone(`PDF ${kinds.length}개를 받고 있어요`);
      return;
    }

    setBusy(true);
    try {
      const files = filesRef.current ?? (await Promise.all(kinds.map((k) => fetchPdfFile(apiUrl(k), fileName(k)))));
      filesRef.current = files;
      if (isIosApp()) {
        const r = await shareFiles(files);
        if (r === "blocked") setReady(files);
        return;
      }
      downloadFiles(files);
      setDone(`PDF ${files.length}개를 저장했어요`);
    } catch (e) {
      setDone(e instanceof Error ? e.message : "PDF를 받지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function shareReady() {
    if (!ready) return;
    const r = await shareFiles(ready);
    if (r === "cancelled") return;
    setReady(null);
    if (r === "blocked") {
      downloadFiles(ready);
      setDone(`PDF ${ready.length}개를 저장했어요`);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-flex", ...wrapStyle }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); download(); }}
        aria-label="시험지·해설 PDF 받기"
        title="시험지·해설 PDF 받기(인쇄·한 번에 보기)"
        aria-busy={busy}
        style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
      >
        <svg width={label ? 18 : 21} height={label ? 18 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: iconColor }} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11" />
          <polyline points="7 10.5 12 15.5 17 10.5" />
          <path d="M5 19.5h14" />
        </svg>
        {label && <span>{busy ? "받는 중…" : label}</span>}
      </button>

      {ready && createPortal(
        <>
          <div onClick={() => setReady(null)} style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 399, background: "rgba(0,0,0,0.25)" }} />
          <div
            role="dialog"
            style={{
              position: "fixed", left: "50%", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", transform: "translateX(-50%)",
              zIndex: 400, width: "min(340px, calc(100vw - 32px))", background: "var(--c-bg)", borderRadius: 18, padding: 16,
              border: "1px solid var(--c-border, rgba(0,0,0,0.08))", boxShadow: "0 16px 40px rgba(15,23,42,0.28)",
            }}
          >
            <p style={{ margin: "2px 4px 12px", fontSize: 15, fontWeight: 700, color: "var(--c-text-b)" }}>
              PDF {ready.length}개를 받았어요
            </p>
            <button
              type="button"
              onClick={shareReady}
              style={{
                display: "block", width: "100%", height: 48, borderRadius: 14, border: "none",
                background: "#3182f6", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              저장·인쇄하기
            </button>
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
