"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

// 노란 메모지 느낌의 퀴즈 노트. 줄노트 위에 글을 쓰고, '그리기'로 바꾸면
// 같은 종이 위에 펜으로 그림/도식을 그릴 수 있다(그림은 dataURL로 저장).
const PAD_H = 264; // 종이 높이(px). 캔버스 좌표 안정성을 위해 고정.
const LINE_H = 28; // 줄 간격 = textarea line-height
const BAR_H = 38; // 종이 하단 도구 띠(글/그림 영역과 겹치지 않게 분리)
const DRAW_H = PAD_H - BAR_H; // 실제 필기/그리기 영역 높이
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
      {/* 노란 메모지(도구는 종이 안쪽 우상단에 최소한으로) */}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          height: PAD_H,
          borderRadius: "4px 4px 10px 10px",
          overflow: "hidden",
          background: "var(--c-warn-soft-5)",
          backgroundImage:
            `repeating-linear-gradient(180deg, transparent 0 ${LINE_H - 1}px, rgba(190,170,90,0.35) ${LINE_H - 1}px ${LINE_H}px)`,
          backgroundPosition: `0 14px`,
          boxShadow: "0 6px 18px rgba(150,130,40,0.22), inset 0 -18px 24px -18px rgba(150,130,40,0.35)",
        }}
      >
        {/* 상단 테이프 */}
        <span
          aria-hidden
          style={{
            position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-1.5deg)",
            width: 96, height: 22, background: "var(--c-bg-a55)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)", zIndex: 3, pointerEvents: "none",
          }}
        />

        {/* 도구: 쓰기/그리기 전환 + (그리기일 때) 색·지우개·되돌리기 */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: BAR_H, zIndex: 4,
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
          padding: "0 34px 0 10px",
          borderTop: "1px solid rgba(190,170,90,0.45)",
          background: "linear-gradient(180deg, rgba(255,248,184,0.75) 0%, #FFF6A8 60%)",
        }}>
          {mode === "draw" && (
            <>
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`펜 색상 ${c}`}
                  onClick={() => { setColor(c); setEraser(false); }}
                  style={{
                    width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer", padding: 0,
                    border: !eraser && color === c ? "2.5px solid var(--c-bg)" : "1.5px solid var(--c-bg-a75)",
                    boxShadow: !eraser && color === c ? "0 0 0 1.5px var(--c-warn-deep-4)" : "0 1px 2px rgba(0,0,0,0.12)",
                  }}
                />
              ))}
              <button type="button" onClick={() => setEraser((v) => !v)} aria-label="지우개" style={iconBtn(eraser)}>⌫</button>
              <button type="button" onClick={undo} aria-label="되돌리기" style={iconBtn(false)}>↺</button>
              <button type="button" onClick={clearAll} aria-label="전체 지우기" style={iconBtn(false)}>✕</button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "write" ? "draw" : "write"))}
            aria-label={mode === "write" ? "그리기로 전환" : "쓰기로 전환"}
            style={{
              height: 26, padding: "0 10px", borderRadius: 999, cursor: "pointer",
              border: "1px solid rgba(138,106,0,0.25)",
              background: mode === "draw" ? "var(--c-warn-c)" : "var(--c-bg-a70)",
              color: mode === "draw" ? "#fff" : "var(--c-warn-deep)",
              fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap",
            }}
          >
            {mode === "write" ? "✏️ 쓰기" : "🖌️ 그리기"}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          readOnly={mode === "draw"}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: DRAW_H,
            boxSizing: "border-box", padding: `14px 16px`,
            background: "transparent", border: "none", outline: "none", resize: "none",
            fontSize: 16, lineHeight: `${LINE_H}px`, color: "var(--c-warn-deep-3)",
            fontFamily: "inherit", letterSpacing: "-0.1px",
            zIndex: 1,
          }}
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
      </div>
    </div>
  );
});

function iconBtn(active: boolean): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 999, cursor: "pointer", padding: 0,
    border: "1px solid rgba(138,106,0,0.22)",
    background: active ? "var(--c-warn-c)" : "var(--c-bg-a70)",
    color: active ? "#fff" : "var(--c-warn-deep)",
    fontSize: 13, fontWeight: 800, lineHeight: 1,
  };
}

export default QuizMemoPad;
