"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type PenTool = "pen" | "highlighter" | "eraser";

export interface HandwritingCanvasHandle {
  /** PNG data URL of the strokes on a transparent background (for saving). */
  exportPng: () => string | null;
  /** PNG data URL on a white background (better for OCR). */
  exportPngForOcr: () => string | null;
  clear: () => void;
  undo: () => void;
  hasStrokes: () => boolean;
  /** Draw a previously-saved PNG as the base layer. */
  loadFromDataUrl: (url: string | null) => void;
}

interface Stroke {
  tool: PenTool;
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

const COLORS = ["#111827", "#EF4444", "#2563EB", "#16A34A", "#F59E0B"];
const PEN_SIZE = 3;
const HIGHLIGHTER_SIZE = 18;
const ERASER_SIZE = 24;

interface Props {
  /** When true the canvas captures pointer events (필기 모드). Otherwise it lets
   *  taps pass through to the quiz underneath. */
  active: boolean;
  onToggleActive: (next: boolean) => void;
}

const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, Props>(function HandwritingCanvas(
  { active, onToggleActive },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);

  const [tool, setTool] = useState<PenTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [, forceRender] = useState(0);

  const applyToolStyle = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (s.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = s.size;
    } else if (s.tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "butt";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (bgImageRef.current) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(bgImageRef.current, 0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    for (const s of strokesRef.current) {
      if (s.points.length === 0) continue;
      applyToolStyle(ctx, s);
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [applyToolStyle]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [resize]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    // Only the Apple Pencil draws. Finger touches must fall through so the user
    // can still scroll the solve pane and use the edge swipe-back gesture —
    // otherwise a finger is mistaken for the pen and navigation is swallowed.
    if (e.pointerType === "touch") return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const size = tool === "pen" ? PEN_SIZE : tool === "highlighter" ? HIGHLIGHTER_SIZE : ERASER_SIZE;
    currentRef.current = { tool, color, size, points: [pointFromEvent(e)] };
    strokesRef.current.push(currentRef.current);
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active || !drawingRef.current || !currentRef.current) return;
    e.preventDefault();
    // Coalesced events give smoother Apple Pencil strokes.
    const events = typeof e.nativeEvent.getCoalescedEvents === "function"
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    for (const ev of events) {
      currentRef.current.points.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    }
    redraw();
  };

  const endStroke = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    currentRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      exportPng: () => {
        if (strokesRef.current.length === 0 && !bgImageRef.current) return null;
        return canvasRef.current?.toDataURL("image/png") ?? null;
      },
      exportPngForOcr: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        if (strokesRef.current.length === 0 && !bgImageRef.current) return null;
        const off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        const ctx = off.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(canvas, 0, 0);
        return off.toDataURL("image/png");
      },
      clear: () => {
        strokesRef.current = [];
        bgImageRef.current = null;
        redraw();
      },
      undo: () => {
        strokesRef.current.pop();
        redraw();
      },
      hasStrokes: () => strokesRef.current.length > 0 || !!bgImageRef.current,
      loadFromDataUrl: (url: string | null) => {
        strokesRef.current = [];
        if (!url) {
          bgImageRef.current = null;
          redraw();
          return;
        }
        const img = new Image();
        img.onload = () => {
          bgImageRef.current = img;
          redraw();
        };
        img.src = url;
      },
    }),
    [redraw]
  );

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        style={{
          position: "absolute",
          inset: 0,
          // Allow finger pan (scroll + edge swipe-back) even while 필기 is on;
          // pen drawing is handled via pointer events guarded to pointerType=pen.
          touchAction: active ? "pan-x pan-y" : "auto",
          pointerEvents: active ? "auto" : "none",
          cursor: active ? "crosshair" : "default",
        }}
      />

      {/* Floating toolbar */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
          border: "1px solid #E5E7EB",
          pointerEvents: "auto",
          flexWrap: "wrap",
          maxWidth: "94%",
        }}
      >
        <ToolBtn label="필기" on={active} onClick={() => onToggleActive(!active)} emphasize />
        <Divider />
        <ToolBtn label="펜" on={active && tool === "pen"} onClick={() => { setTool("pen"); onToggleActive(true); forceRender((n) => n + 1); }} />
        <ToolBtn label="형광펜" on={active && tool === "highlighter"} onClick={() => { setTool("highlighter"); onToggleActive(true); forceRender((n) => n + 1); }} />
        <ToolBtn label="지우개" on={active && tool === "eraser"} onClick={() => { setTool("eraser"); onToggleActive(true); forceRender((n) => n + 1); }} />
        <Divider />
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`색상 ${c}`}
            onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); onToggleActive(true); forceRender((n) => n + 1); }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: c,
              border: color === c ? "2px solid #111827" : "2px solid #fff",
              boxShadow: "0 0 0 1px #E5E7EB",
              cursor: "pointer",
            }}
          />
        ))}
        <Divider />
        <ToolBtn label="실행취소" on={false} onClick={() => { strokesRef.current.pop(); redraw(); }} />
        <ToolBtn label="전체삭제" on={false} onClick={() => { strokesRef.current = []; bgImageRef.current = null; redraw(); }} />
      </div>
    </div>
  );
});

function Divider() {
  return <span style={{ width: 1, height: 18, background: "#E5E7EB" }} />;
}

function ToolBtn({
  label,
  on,
  onClick,
  emphasize,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  emphasize?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        background: on ? "#111827" : emphasize ? "#EEF2FF" : "transparent",
        color: on ? "#fff" : emphasize ? "#3730A3" : "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export default HandwritingCanvas;
