"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tool = "pen" | "highlight" | "eraser" | "ocr";

interface Exam {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrls: string[];
}

const PEN_COLORS = ["#111827", "#EF4444", "#3787FF", "#10B981"];
const HL_COLORS = ["#FFE44D", "#8CF08C", "#FFB3D1", "#9DD8FF"];

// Tesseract.js를 필요할 때만 CDN에서 로드(메인 번들에 포함 안 함).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTesseract(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.Tesseract) return w.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("OCR 엔진 로드 실패"));
    document.head.appendChild(s);
  });
  return w.Tesseract;
}

interface PageHandle {
  undo: () => void;
  clear: () => void;
}

const PageCanvas = forwardRef<
  PageHandle,
  {
    examId: string;
    pageIndex: number;
    imageUrl: string;
    tool: Tool;
    color: string;
    width: number;
    onActive: () => void;
    onOcrRegion: (dataUrl: string) => void;
  }
>(function PageCanvas({ examId, pageIndex, imageUrl, tool, color, width, onActive, onOcrRegion }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<string[]>([]);
  const selStart = useRef<{ x: number; y: number } | null>(null);
  const [sized, setSized] = useState(false);

  const storageKey = `mockexam_${examId}_p${pageIndex}`;

  function fit() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    setSized(true);
    // 저장된 필기 복원.
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) restore(saved);
    } catch {
      /* ignore */
    }
  }

  function restore(dataUrl: string) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const im = new Image();
    im.onload = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(im, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    im.src = dataUrl;
  }

  function persist() {
    try {
      const canvas = canvasRef.current;
      if (canvas) localStorage.setItem(storageKey, canvas.toDataURL("image/png"));
    } catch {
      /* 용량 초과 등은 무시 */
    }
  }

  useImperativeHandle(ref, () => ({
    undo() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      undoStack.current.pop();
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const prev = undoStack.current[undoStack.current.length - 1];
      if (prev) restore(prev);
      persist();
    },
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      undoStack.current = [];
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    },
  }));

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: React.PointerEvent) {
    // 손가락(touch)은 스크롤용 — 펜/마우스만 필기/선택.
    if (e.pointerType === "touch") return;
    onActive();
    const p = pos(e);
    if (tool === "ocr") {
      selStart.current = p;
      if (selRef.current) {
        selRef.current.style.display = "block";
        selRef.current.style.left = `${p.x}px`;
        selRef.current.style.top = `${p.y}px`;
        selRef.current.style.width = "0px";
        selRef.current.style.height = "0px";
      }
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    drawing.current = true;
    last.current = p;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // 스트로크 시작 전 상태를 undo 스택에 저장.
    const canvas = canvasRef.current;
    if (canvas && undoStack.current.length === 0) undoStack.current.push(canvas.toDataURL("image/png"));
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    const p = pos(e);
    if (tool === "ocr") {
      if (!selStart.current || !selRef.current) return;
      const s = selStart.current;
      selRef.current.style.left = `${Math.min(s.x, p.x)}px`;
      selRef.current.style.top = `${Math.min(s.y, p.y)}px`;
      selRef.current.style.width = `${Math.abs(p.x - s.x)}px`;
      selRef.current.style.height = `${Math.abs(p.y - s.y)}px`;
      return;
    }
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = 22;
    } else if (tool === "highlight") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 18;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      ctx.lineWidth = width * (0.5 + pressure);
    }
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    last.current = p;
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (tool === "ocr") {
      const s = selStart.current;
      selStart.current = null;
      if (selRef.current) selRef.current.style.display = "none";
      if (!s) return;
      const p = pos(e);
      const x = Math.min(s.x, p.x);
      const y = Math.min(s.y, p.y);
      const w = Math.abs(p.x - s.x);
      const h = Math.abs(p.y - s.y);
      if (w < 8 || h < 8) return;
      cropAndOcr(x, y, w, h);
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      undoStack.current.push(canvas.toDataURL("image/png"));
      if (undoStack.current.length > 25) undoStack.current.shift();
    }
    persist();
  }

  // 이미지 원본 해상도에서 선택 영역을 잘라 OCR로 넘긴다.
  function cropAndOcr(cx: number, cy: number, cw: number, ch: number) {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return;
    const scaleX = img.naturalWidth / wrap.clientWidth;
    const scaleY = img.naturalHeight / wrap.clientHeight;
    const off = document.createElement("canvas");
    off.width = Math.round(cw * scaleX);
    off.height = Math.round(ch * scaleY);
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.drawImage(
      img,
      cx * scaleX,
      cy * scaleY,
      cw * scaleX,
      ch * scaleY,
      0,
      0,
      off.width,
      off.height
    );
    onOcrRegion(off.toDataURL("image/png"));
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", marginBottom: 12, background: "#fff", lineHeight: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt={`페이지 ${pageIndex + 1}`}
        onLoad={fit}
        style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }}
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: "absolute",
          inset: 0,
          touchAction: "pan-y",
          cursor: tool === "ocr" ? "crosshair" : "crosshair",
          opacity: sized ? 1 : 0,
        }}
      />
      <div
        ref={selRef}
        style={{ position: "absolute", display: "none", border: "2px dashed #3787FF", background: "rgba(55,135,255,0.12)", pointerEvents: "none" }}
      />
    </div>
  );
});

export default function MockExamViewer({ exam }: { exam: Exam }) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [hlColor, setHlColor] = useState(HL_COLORS[0]);
  const [width, setWidth] = useState(3);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const pageRefs = useRef<(PageHandle | null)[]>([]);
  const activePage = useRef(0);

  async function runOcr(dataUrl: string) {
    setOcrBusy(true);
    setOcrText("");
    try {
      const T = await loadTesseract();
      const { data } = await T.recognize(dataUrl, "kor+eng");
      setOcrText((data?.text || "").trim() || "(인식된 글자가 없어요)");
    } catch {
      setOcrText("OCR 인식에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setOcrBusy(false);
    }
  }

  const activeColor = tool === "highlight" ? hlColor : penColor;
  const colors = tool === "highlight" ? HL_COLORS : PEN_COLORS;
  const setActiveColor = tool === "highlight" ? setHlColor : setPenColor;

  const toolBtn = (t: Tool, label: string, icon: string) => (
    <button
      type="button"
      onClick={() => setTool(t)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52,
        padding: "6px 8px", borderRadius: 10, border: "none",
        background: tool === t ? "#111827" : "#F1F3F5", color: tool === t ? "#fff" : "#4E5968",
        fontSize: 11, fontWeight: 700, cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#EDEFF2" }}>
      {/* 툴바 */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: "1px solid #E5E7EB",
          padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={() => router.back()} aria-label="뒤로" style={{ border: "none", background: "none", padding: 4, cursor: "pointer" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#191F28", marginRight: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exam.title}</div>
        {toolBtn("pen", "펜", "✏️")}
        {toolBtn("highlight", "형광펜", "🖍️")}
        {toolBtn("eraser", "지우개", "🧽")}
        {toolBtn("ocr", "OCR", "🔤")}
        {(tool === "pen" || tool === "highlight") && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {colors.map((c) => (
              <button key={c} type="button" onClick={() => setActiveColor(c)} aria-label={c}
                style={{ width: 24, height: 24, borderRadius: 999, background: c, border: activeColor === c ? "3px solid #111827" : "2px solid #fff", boxShadow: "0 0 0 1px #E5E7EB", cursor: "pointer" }} />
            ))}
          </div>
        )}
        {tool === "pen" && (
          <input type="range" min={1} max={8} value={width} onChange={(e) => setWidth(Number(e.target.value))} style={{ width: 70 }} aria-label="펜 굵기" />
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => pageRefs.current[activePage.current]?.undo()} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#4E5968", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>되돌리기</button>
          <button type="button" onClick={() => { if (confirm("이 페이지 필기를 지울까요?")) pageRefs.current[activePage.current]?.clear(); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #FECACA", background: "#fff", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>페이지 지우기</button>
        </div>
      </div>

      {/* 안내 */}
      <p style={{ margin: 0, padding: "8px 14px", fontSize: 12, color: "#8A909C", textAlign: "center" }}>
        애플펜슬(펜)로 필기하고, 손가락으로 스크롤하세요. OCR은 글자 영역을 드래그해 선택하면 됩니다.
      </p>

      {/* 페이지들 */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 8px 40px" }}>
        {exam.imageUrls.length === 0 ? (
          <p style={{ textAlign: "center", color: "#8A909C", padding: 40 }}>등록된 시험지 이미지가 없습니다.</p>
        ) : (
          exam.imageUrls.map((url, i) => (
            <PageCanvas
              key={url}
              ref={(el) => { pageRefs.current[i] = el; }}
              examId={exam.id}
              pageIndex={i}
              imageUrl={url}
              tool={tool}
              color={activeColor}
              width={width}
              onActive={() => { activePage.current = i; }}
              onOcrRegion={runOcr}
            />
          ))
        )}
      </div>

      {/* OCR 결과 모달 */}
      {ocrText !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !ocrBusy && setOcrText(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "#191F28" }}>OCR 결과</h3>
            {ocrBusy ? (
              <p style={{ color: "#8A909C", fontSize: 14 }}>글자를 인식하는 중이에요… (처음엔 엔진을 받느라 조금 걸려요)</p>
            ) : (
              <textarea readOnly value={ocrText} style={{ width: "100%", minHeight: 160, borderRadius: 12, border: "1px solid #E5E7EB", padding: 12, fontSize: 14, lineHeight: 1.6, color: "#191F28", resize: "vertical", boxSizing: "border-box" }} />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {!ocrBusy && (
                <button type="button" onClick={() => { navigator.clipboard?.writeText(ocrText || ""); }} style={{ flex: 1, height: 46, borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff", color: "#3787FF", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>복사</button>
              )}
              <button type="button" disabled={ocrBusy} onClick={() => setOcrText(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: "none", background: "#3787FF", color: "#fff", fontSize: 15, fontWeight: 800, cursor: ocrBusy ? "default" : "pointer", opacity: ocrBusy ? 0.6 : 1 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
