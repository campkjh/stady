"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

// 노란 메모지 느낌의 퀴즈 노트. 줄노트 위에 글을 쓰고, '그리기'로 바꾸면
// 같은 종이 위에 펜으로 그림/도식을 그릴 수 있다(그림은 dataURL로 저장).
const PAD_H = 250; // 종이 높이(px). 캔버스 좌표 안정성을 위해 고정(CSS .qmp-paper 높이와 같게).
const LINE_H = 28; // 줄 간격 = textarea line-height
const DRAW_H = PAD_H; // 필기/그리기 영역 = 종이 전체(도구는 종이 위 줄로 뺐다)
const PEN_COLORS = ["#1F2937", "#2563EB", "#DC2626", "#059669"];

export interface MemoPadHandle {
  /** 현재 그림을 dataURL로 반환(빈 그림이면 null). */
  exportDrawing: () => string | null;
}

interface Props {
  text: string;
  onTextChange: (v: string) => void;
  /** 저장된 그림(dataURL). 열 때 복원. */
  initialDrawing?: string | null;
  placeholder?: string;
}

const QuizMemoPad = forwardRef<MemoPadHandle, Props>(function QuizMemoPad(
  { text, onTextChange, initialDrawing, placeholder },
  ref
) {
  const [mode, setMode] = useState<"write" | "draw">("write");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [eraser, setEraser] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<string[]>([]);
  const [hasInk, setHasInk] = useState(false);

  // 캔버스 크기 맞추기 + 저장된 그림 복원.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = DRAW_H;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    if (initialDrawing) {
      const im = new Image();
      im.onload = () => {
        ctx?.drawImage(im, 0, 0, w, h);
        setHasInk(true);
      };
      im.src = initialDrawing;
    }
  }, [initialDrawing]);

  // 그리기 모드에서 펜/손가락 드래그가 시트를 스크롤하지 않도록 차단.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const block = (e: TouchEvent) => {
      if (mode === "draw") e.preventDefault();
    };
    canvas.addEventListener("touchstart", block, { passive: false });
    canvas.addEventListener("touchmove", block, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", block);
      canvas.removeEventListener("touchmove", block);
    };
  }, [mode]);

  useImperativeHandle(ref, () => ({
    exportDrawing: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasInk) return null;
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    },
  }));

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (canvas && undoStack.current.length < 20) undoStack.current.push(canvas.toDataURL("image/png"));
    drawing.current = true;
    last.current = pos(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (mode !== "draw" || !drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = e.pointerType === "pen" && e.pressure > 0 ? 1 + e.pressure * 3 : 2.4;
      ctx.strokeStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!eraser) setHasInk(true);
  };

  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const prev = undoStack.current.pop();
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (prev) {
      const im = new Image();
      im.onload = () => ctx.drawImage(im, 0, 0, canvas.clientWidth, canvas.clientHeight);
      im.src = prev;
    } else {
      setHasInk(false);
    }
  }, []);

  const clearAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStack.current.push(canvas.toDataURL("image/png"));
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setHasInk(false);
  }, []);

  return (
    <div>
      {/* 위: 쓰기/그리기 전환(토스식 세그먼트) + 그리기일 때만 펜 색·지우개·되돌리기·전체 지우기 */}
      <div className="qmp-top">
        <div className="qmp-seg" role="tablist" aria-label="메모 방식">
          <span className="qmp-seg-thumb" style={{ transform: `translateX(${mode === "write" ? 0 : 100}%)` }} aria-hidden="true" />
          <button type="button" role="tab" aria-selected={mode === "write"} className={`qmp-seg-btn${mode === "write" ? " on" : ""}`} onClick={() => setMode("write")}>
            쓰기
          </button>
          <button type="button" role="tab" aria-selected={mode === "draw"} className={`qmp-seg-btn${mode === "draw" ? " on" : ""}`} onClick={() => setMode("draw")}>
            그리기
          </button>
        </div>
        {mode === "draw" && (
          <div className="qmp-tools">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`펜 색상 ${c}`}
                className={`qmp-dot${!eraser && color === c ? " on" : ""}`}
                onClick={() => { setColor(c); setEraser(false); }}
                style={{ background: c, color: c }}
              />
            ))}
            <button type="button" className={`qmp-ibtn${eraser ? " on" : ""}`} onClick={() => setEraser((v) => !v)} aria-label="지우개" aria-pressed={eraser}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m8 20-4.2-4.2a1.6 1.6 0 0 1 0-2.3l8.7-8.7a1.6 1.6 0 0 1 2.3 0l4.4 4.4a1.6 1.6 0 0 1 0 2.3L12 20H8Zm0 0h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="qmp-ibtn" onClick={undo} aria-label="되돌리기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 7 5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="qmp-ibtn" onClick={clearAll} aria-label="전체 지우기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 7h14M10 4h4M7 7l.8 12h8.4L17 7M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 노란 메모지 — 줄노트 위에 쓰거나 그린다 */}
      <div
        ref={wrapRef}
        className="qmp-paper"
        style={{
          backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${LINE_H - 1}px, rgba(190,160,60,0.28) ${LINE_H - 1}px ${LINE_H}px)`,
          backgroundPosition: "0 14px",
        }}
      >
        <textarea
          className="qmp-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          readOnly={mode === "draw"}
          style={{ lineHeight: `${LINE_H}px` }}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: DRAW_H, zIndex: 2,
            touchAction: mode === "draw" ? "none" : "auto",
            pointerEvents: mode === "draw" ? "auto" : "none",
            cursor: mode === "draw" ? "crosshair" : "default",
          }}
        />
        <span className="qmp-count">{text.length}/2000</span>
      </div>
    </div>
  );
});

export default QuizMemoPad;
