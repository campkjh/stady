"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useIsTablet } from "@/lib/useIsTablet";
import HandwritingCanvas, { HandwritingCanvasHandle } from "@/components/HandwritingCanvas";

export interface BookmarkTarget {
  quizType: "ox" | "vocab" | "workbook";
  oxQuizSetId?: string | null;
  oxQuestionId?: string | null;
  vocabQuizSetId?: string | null;
  vocabQuestionId?: string | null;
  workbookId?: string | null;
  problemId?: string | null;
}

interface BookmarkRow extends BookmarkTarget {
  memo?: string | null;
  drawing?: string | null;
}

interface Props {
  /** The existing solve-page content. */
  children: ReactNode;
  /** What the memo/handwriting attaches to (the current question/problem). */
  target: BookmarkTarget | null;
  /** Changes when the current question changes, so we reload its saved memo. */
  memoKey: string;
  /** Tablet-only left nav rail actions. Rendered above the handwriting canvas
   *  so the pen can never swallow the back/list taps. The page keeps its own
   *  exit logic (e.g. confirm-on-quit) by passing handlers here. */
  nav?: { onBack?: () => void; onList?: () => void };
}

function matchesTarget(row: BookmarkRow, t: BookmarkTarget): boolean {
  if (row.quizType !== t.quizType) return false;
  const keys: (keyof BookmarkTarget)[] = [
    "oxQuestionId",
    "vocabQuestionId",
    "problemId",
    "oxQuizSetId",
    "vocabQuizSetId",
    "workbookId",
  ];
  for (const k of keys) {
    if (t[k]) {
      if (row[k] !== t[k]) return false;
    }
  }
  return true;
}

export default function SolveWorkspace({ children, target, memoKey, nav }: Props) {
  const isTablet = useIsTablet();
  const canvasRef = useRef<HandwritingCanvasHandle>(null);
  const [penActive, setPenActive] = useState(false);
  const [memo, setMemo] = useState("");
  const [loadedMemo, setLoadedMemo] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [ocrBusy, setOcrBusy] = useState(false);

  // Load any saved memo/drawing for the current question.
  useEffect(() => {
    if (!isTablet || !target) return;
    let cancelled = false;
    setMemo("");
    setLoadedMemo("");
    canvasRef.current?.loadFromDataUrl(null);
    fetch(`/api/bookmarks?quizType=${target.quizType}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { bookmarks: [] }))
      .then((data) => {
        if (cancelled) return;
        const rows: BookmarkRow[] = data.bookmarks || [];
        const found = rows.find((row) => matchesTarget(row, target));
        if (found) {
          setMemo(found.memo || "");
          setLoadedMemo(found.memo || "");
          if (found.drawing) canvasRef.current?.loadFromDataUrl(found.drawing);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, memoKey]);

  const save = useCallback(async () => {
    if (!target) return;
    setStatus("saving");
    try {
      const drawing = canvasRef.current?.exportPng() ?? null;
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, memo, drawing }),
      });
      if (!res.ok) throw new Error("save failed");
      setLoadedMemo(memo);
      setStatus("saved");
      setTimeout(() => setStatus(""), 1800);
    } catch {
      setStatus("error");
    }
  }, [target, memo]);

  const runOcr = useCallback(async () => {
    const image = canvasRef.current?.exportPngForOcr();
    if (!image) {
      setStatus("error");
      return;
    }
    setOcrBusy(true);
    try {
      const res = await fetch("/api/handwriting/ocr", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ocr failed");
      const text = (data.text || "").trim();
      if (text) setMemo((m) => (m ? `${m}\n${text}` : text));
    } catch {
      setStatus("error");
    } finally {
      setOcrBusy(false);
    }
  }, []);

  if (!isTablet) {
    // Phone / non-tablet: unchanged single-column experience.
    return <>{children}</>;
  }

  const dirty = memo !== loadedMemo;

  return (
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100dvh", overflow: "hidden", background: "#fff" }}>
      {/* LEFT 50%: solve area + handwriting overlay.
          translateZ(0) makes this pane the containing block for the page's
          position:fixed top bars so they stay inside the left half. */}
      <div
        style={{
          position: "relative",
          width: "50%",
          height: "100%",
          overflow: "auto",
          transform: "translateZ(0)",
          borderRight: "1px solid #E5E7EB",
        }}
      >
        {children}
        <HandwritingCanvas ref={canvasRef} active={penActive} onToggleActive={setPenActive} />
      </div>

      {/* RIGHT 50%: typed memo. */}
      <div style={{ width: "50%", height: "100%", display: "flex", flexDirection: "column", background: "#FAFAFB" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "calc(12px + env(safe-area-inset-top, 0px)) 16px 12px",
            borderBottom: "1px solid #EEF0F3",
            background: "#fff",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>메모</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status === "saved" && <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 700 }}>저장됨</span>}
            {status === "error" && <span style={{ fontSize: 13, color: "#EF4444", fontWeight: 700 }}>오류</span>}
            <button
              onClick={runOcr}
              disabled={ocrBusy}
              style={btnStyle(false)}
              title="필기한 글씨를 인식해 메모에 넣습니다"
            >
              {ocrBusy ? "인식 중..." : "필기 → 텍스트"}
            </button>
            <button onClick={save} disabled={!target || status === "saving"} style={btnStyle(true)}>
              {status === "saving" ? "저장 중..." : dirty ? "저장" : "저장됨"}
            </button>
          </div>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="여기에 메모를 입력하세요. 저장하면 책갈피에 보관됩니다."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            resize: "none",
            padding: 16,
            fontSize: 16,
            lineHeight: 1.6,
            color: "#111827",
            background: "transparent",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Left nav rail (tablet only): sits at the root level above the
          handwriting canvas (z-index 40) and outside the scrolling pane, so the
          pen can never swallow the back / list taps the way the in-page header
          did. The page supplies the handlers to keep its own exit logic. */}
      {nav && (
        <div
          style={{
            position: "absolute",
            top: "calc(10px + env(safe-area-inset-top, 0px))",
            left: 10,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {nav.onBack && (
            <button onClick={nav.onBack} aria-label="뒤로가기" style={railBtnStyle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {nav.onList && (
            <button onClick={nav.onList} aria-label="목록" style={railBtnStyle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const railBtnStyle = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid #E5E7EB",
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

function btnStyle(primary: boolean) {
  return {
    border: primary ? "none" : "1px solid #D1D5DB",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    background: primary ? "#111827" : "#fff",
    color: primary ? "#fff" : "#374151",
    whiteSpace: "nowrap",
  } as const;
}
