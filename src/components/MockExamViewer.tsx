"use client";

import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tool = "pen" | "highlight" | "eraser" | "ocr";

// 페이지별 텍스트 줄 박스 [x, y, w, h] (페이지 대비 0~1 정규화). 형광펜 스냅용.
type LineBox = [number, number, number, number];

interface Exam {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrls: string[];
  lineBoxes: LineBox[][];
  solutionImageUrls: string[];
  solutionLineBoxes: LineBox[][];
}

// 형광펜이 그려질 가로 띠. top/height는 CSS px, left/right는 줄 가로 범위(없으면 null).
interface HighlightBand {
  top: number;
  height: number;
  left: number | null;
  right: number | null;
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
  redo: () => void;
  clear: () => void;
}

// 한 획이 바꾼 사각형 영역의 이전/이후 픽셀(디바이스 px 좌표).
interface StrokePatch {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

const PageCanvas = forwardRef<
  PageHandle,
  {
    examId: string;
    section: "problem" | "solution";
    pageIndex: number;
    imageUrl: string;
    lines: LineBox[];
    tool: Tool;
    color: string;
    width: number;
    eraserWidth: number;
    onActive: () => void;
    onOcrRegion: (dataUrl: string) => void;
    onHistoryChange?: (h: { canUndo: boolean; canRedo: boolean }) => void;
  }
>(function PageCanvas({ examId, section, pageIndex, imageUrl, lines, tool, color, width, eraserWidth, onActive, onOcrRegion, onHistoryChange }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  // 캔버스 픽셀 비율. ImageData는 항상 디바이스 픽셀 기준이라 CSS 좌표 변환에 쓴다.
  const dprRef = useRef(1);
  // 직전 획까지의 픽셀을 담아두는 그림자 캔버스(되돌리기의 '이전 상태' 소스).
  const shadowRef = useRef<HTMLCanvasElement | null>(null);
  // 획 단위 되돌리기/앞으로. 획이 건드린 사각형의 before/after 픽셀만 보관한다.
  // 전체 캔버스를 PNG로 인코딩(toDataURL)하면 아이패드에서 획당 수백 ms 동안
  // 메인 스레드가 멈추고, 그 사이 시작된 다음 획이 통째로 인식되지 않았다.
  const undoStack = useRef<StrokePatch[]>([]);
  const redoStack = useRef<StrokePatch[]>([]);
  // 현재 획이 지나간 영역(CSS px). 커밋할 때 이 사각형만 잘라 저장한다.
  const strokeBox = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 필기 중에는 저장을 미루는 타이머(연속 필기 중 localStorage 쓰기로 끊기지 않게).
  const persistTimer = useRef<number | null>(null);
  // 획을 긋는 동안 고정해두는 캔버스 위치/배율(매 move마다 레이아웃 강제 계산 방지).
  const rectRef = useRef<{ left: number; top: number; sx: number; sy: number } | null>(null);
  const notifyHistory = () => {
    onHistoryChange?.({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 });
  };
  const selStart = useRef<{ x: number; y: number } | null>(null);
  // 형광펜 스냅용: 시작 시점의 띠 영역 스냅샷 + 시작 x + 대상 줄 띠.
  const hlSnap = useRef<ImageData | null>(null);
  const hlSnapY = useRef(0);
  const hlStartX = useRef(0);
  const hlBand = useRef<HighlightBand | null>(null);
  const eraserCurRef = useRef<HTMLDivElement>(null);
  // 마지막으로 캔버스를 맞춘 크기(같은 크기로 다시 맞추면 필기가 지워지므로).
  const fittedSize = useRef({ w: 0, h: 0 });
  const [sized, setSized] = useState(false);

  // 지우개 커서: 지울 영역만큼의 원형 보더를 포인터 위치에 표시.
  function showEraserCursor(px: number, py: number) {
    const el = eraserCurRef.current;
    if (!el) return;
    el.style.width = `${eraserWidth}px`;
    el.style.height = `${eraserWidth}px`;
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.display = "block";
  }
  function hideEraserCursor() {
    const el = eraserCurRef.current;
    if (el) el.style.display = "none";
  }
  // 도구를 지우개가 아닌 것으로 바꾸면 커서 숨김.
  useEffect(() => {
    if (tool !== "eraser") hideEraserCursor();
  }, [tool]);

  // 문제/해설 필기가 섞이지 않게 섹션을 키에 포함(문제는 기존 키 유지=하위호환).
  const storageKey = `mockexam_${examId}${section === "solution" ? "_sol" : ""}_p${pageIndex}`;

  // 캔버스 크기 맞추기는 이미지 onLoad에만 기대면 안 된다. 캐시된 이미지는
  // 리액트가 핸들러를 붙이기 전에 이미 로드가 끝나 onLoad가 오지 않아서, 그
  // 페이지 캔버스가 초기화되지 않은 채(=필기해도 아무것도 안 그려짐) 남았다.
  // 마운트 시 한 번 맞추고, 이후 레이아웃 크기가 실제로 바뀔 때만 다시 맞춘다.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 애플펜슬 필기 중 화면이 같이 스크롤되는 문제 방지.
  // touch-action: pan-y는 포인터 종류를 구분하지 못해 펜 드래그도 팬(스크롤)으로
  // 처리된다 → 스타일러스 터치(iOS Safari/WebView는 touchType==="stylus")와
  // 펜 스트로크/OCR 선택 중의 손바닥 터치는 non-passive 리스너에서 preventDefault로
  // 스크롤 제스처를 차단한다. 손가락 단독 터치는 그대로 스크롤.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const block = (e: TouchEvent) => {
      const stylus = Array.from(e.changedTouches).some(
        (t) => (t as Touch & { touchType?: string }).touchType === "stylus"
      );
      if (stylus || drawing.current || selStart.current) e.preventDefault();
    };
    canvas.addEventListener("touchstart", block, { passive: false });
    canvas.addEventListener("touchmove", block, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", block);
      canvas.removeEventListener("touchmove", block);
    };
  }, []);

  function fit() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    // 같은 크기로 다시 부르면 그린 내용과 되돌리기 이력만 날아가므로 무시한다.
    if (fittedSize.current.w === w && fittedSize.current.h === h) return;
    fittedSize.current = { w, h };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    setSized(true);
    // 크기가 바뀌면 이전 패치 좌표가 어긋나므로 되돌리기 이력은 초기화.
    undoStack.current = [];
    redoStack.current = [];
    shadowRef.current = null;
    notifyHistory();
    // 저장된 필기 복원.
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) restore(saved);
      else syncShadow();
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
      syncShadow();
    };
    im.src = dataUrl;
  }

  // 그림자 캔버스를 현재 캔버스와 같은 크기로 만들고 내용을 그대로 복사한다.
  function syncShadow() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    let shadow = shadowRef.current;
    if (!shadow || shadow.width !== canvas.width || shadow.height !== canvas.height) {
      shadow = document.createElement("canvas");
      shadow.width = canvas.width;
      shadow.height = canvas.height;
      shadowRef.current = shadow;
    }
    const sctx = shadow.getContext("2d");
    if (!sctx) return null;
    sctx.clearRect(0, 0, shadow.width, shadow.height);
    sctx.drawImage(canvas, 0, 0);
    return shadow;
  }

  function persist() {
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    try {
      const canvas = canvasRef.current;
      if (canvas) localStorage.setItem(storageKey, canvas.toDataURL("image/png"));
    } catch {
      /* 용량 초과 등은 무시 */
    }
  }

  // 저장(전체 캔버스 PNG 인코딩 + localStorage 쓰기)은 무겁다. 획이 끝날 때마다
  // 바로 하지 않고 손을 뗀 뒤 잠깐 쉴 때 한 번만 처리해, 연속으로 쓰는 동안
  // 메인 스레드가 막혀 다음 획을 놓치는 일이 없게 한다.
  function schedulePersist() {
    if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      if (drawing.current) {
        schedulePersist(); // 아직 쓰는 중이면 더 미룬다.
        return;
      }
      persist();
    }, 900);
  }

  // 화면을 벗어나거나 앱이 백그라운드로 갈 때는 밀린 저장을 즉시 반영.
  useEffect(() => {
    const flush = () => {
      if (persistTimer.current != null) persist();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 패치 하나를 캔버스와 그림자에 그대로 덮어쓴다(putImageData는 합성 없이 교체).
  function applyPatch(pixels: ImageData, x: number, y: number) {
    const ctx = canvasRef.current?.getContext("2d");
    const sctx = (shadowRef.current ?? syncShadow())?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(pixels, x, y);
    sctx?.putImageData(pixels, x, y);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      const patch = undoStack.current.pop();
      if (!patch) return;
      applyPatch(patch.before, patch.x, patch.y);
      redoStack.current.push(patch);
      schedulePersist();
      notifyHistory();
    },
    redo() {
      const patch = redoStack.current.pop();
      if (!patch) return;
      applyPatch(patch.after, patch.x, patch.y);
      undoStack.current.push(patch);
      schedulePersist();
      notifyHistory();
    },
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      syncShadow();
      undoStack.current = [];
      redoStack.current = [];
      if (persistTimer.current != null) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      notifyHistory();
    },
  }));

  // 획이 지나간 영역을 넓혀 기록(선 굵기의 절반 + 여유).
  function markBox(x: number, y: number, r: number) {
    const b = strokeBox.current;
    if (!b) {
      strokeBox.current = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
      return;
    }
    if (x - r < b.x0) b.x0 = x - r;
    if (y - r < b.y0) b.y0 = y - r;
    if (x + r > b.x1) b.x1 = x + r;
    if (y + r > b.y1) b.y1 = y + r;
  }

  // 획을 끝내며 바뀐 영역만 잘라 되돌리기 스택에 넣는다(작은 getImageData 2번).
  function commitStroke() {
    const box = strokeBox.current;
    strokeBox.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !box) return;
    const shadow = shadowRef.current ?? syncShadow();
    const sctx = shadow?.getContext("2d");
    if (!shadow || !sctx) return;
    const dpr = dprRef.current;
    const x = Math.max(0, Math.floor(box.x0 * dpr));
    const y = Math.max(0, Math.floor(box.y0 * dpr));
    const w = Math.min(canvas.width - x, Math.ceil((box.x1 - box.x0) * dpr) + 2);
    const h = Math.min(canvas.height - y, Math.ceil((box.y1 - box.y0) * dpr) + 2);
    if (w <= 0 || h <= 0) return;
    const before = sctx.getImageData(x, y, w, h);
    const after = ctx.getImageData(x, y, w, h);
    undoStack.current.push({ x, y, before, after });
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
    sctx.putImageData(after, x, y);
    schedulePersist();
    notifyHistory();
  }

  // 확대(CSS scale) 중이면 getBoundingClientRect가 확대된 크기라, 캔버스 내부
  // CSS 좌표로 되돌리려면 실제 렌더 크기 대비 비율을 곱한다(확대해도 필기 정확).
  function measure() {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      sx: r.width ? canvas.clientWidth / r.width : 1,
      sy: r.height ? canvas.clientHeight / r.height : 1,
    };
  }

  // 획을 긋는 동안에는 시작 시점에 잰 값을 재사용한다. 매 move마다 rect를 재면
  // 포인터 이벤트마다 레이아웃이 강제 계산돼 빠르게 쓸 때 이벤트가 밀린다.
  function point(clientX: number, clientY: number) {
    const m = rectRef.current ?? measure();
    return { x: (clientX - m.left) * m.sx, y: (clientY - m.top) * m.sy };
  }

  function pos(e: { clientX: number; clientY: number }) {
    return point(e.clientX, e.clientY);
  }

  // 시작점에 해당하는 글자 줄을 찾아 형광펜 띠를 만든다. 줄 데이터가 없거나
  // 근처에 줄이 없으면(빈 공간) 시작 y에 고정된 수평 띠로 대체(그래도 일직선).
  function bandAt(px: number, py: number): HighlightBand {
    const wrap = wrapRef.current;
    const W = wrap?.clientWidth ?? 0;
    const H = wrap?.clientHeight ?? 0;
    const fallback: HighlightBand = { top: py - 9, height: 18, left: null, right: null };
    if (!W || !H || lines.length === 0) return fallback;
    const nx = px / W;
    const ny = py / H;
    let best: LineBox | null = null;
    let bestDy = Infinity;
    // 1순위: 시작 x가 가로 범위에 걸치는 줄(2단 편집에서 올바른 열 선택).
    for (const [lx, ly, lw, lh] of lines) {
      if (nx < lx - 0.005 || nx > lx + lw + 0.005) continue;
      const inside = ny >= ly && ny <= ly + lh;
      const dy = inside ? 0 : Math.abs(ny - (ly + lh / 2));
      if (dy < bestDy) { bestDy = dy; best = [lx, ly, lw, lh]; }
    }
    // 2순위: 걸치는 줄이 없으면 y로 가장 가까운 줄(단, 너무 멀면 스냅 안 함).
    if (!best) {
      for (const [lx, ly, lw, lh] of lines) {
        const dy = Math.abs(ny - (ly + lh / 2));
        if (dy < bestDy) { bestDy = dy; best = [lx, ly, lw, lh]; }
      }
      if (best && bestDy > 0.02) best = null;
    }
    if (!best) return fallback;
    const [lx, ly, lw, lh] = best;
    const padY = lh * 0.2;
    return {
      top: (ly - padY) * H,
      height: (lh + padY * 2) * H,
      left: lx * W,
      right: (lx + lw) * W,
    };
  }

  // 스냅샷을 복원한 뒤 시작x~현재x 범위에 줄 띠를 채운다(겹쳐도 진해지지 않음).
  function paintHighlight(curX: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const band = hlBand.current;
    if (!canvas || !ctx || !band || !hlSnap.current) return;
    ctx.putImageData(hlSnap.current, 0, hlSnapY.current);
    let x0 = Math.min(hlStartX.current, curX);
    let x1 = Math.max(hlStartX.current, curX);
    if (band.left != null && band.right != null) {
      x0 = Math.max(x0, band.left);
      x1 = Math.min(x1, band.right);
    }
    if (x1 - x0 < 1) return;
    markBox(x0, band.top, 0);
    markBox(x1, band.top + band.height, 0);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.fillRect(x0, band.top, x1 - x0, band.height);
    ctx.restore();
  }

  // 포인터가 이미 놓였거나 캡처가 불가한 상황에서 예외로 획이 끊기지 않게 감싼다.
  function capture(e: React.PointerEvent) {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onDown(e: React.PointerEvent) {
    // 손가락(touch)은 스크롤용 — 펜/마우스만 필기/선택.
    if (e.pointerType === "touch") return;
    onActive();
    rectRef.current = measure();
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
      capture(e);
      return;
    }
    if (tool === "highlight") {
      // 글자 줄에 스냅한 일직선 형광펜. 시작 시점 스냅샷을 떠서 러버밴드로 그린다.
      drawing.current = true;
      hlStartX.current = p.x;
      const band = bandAt(p.x, p.y);
      hlBand.current = band;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        // 전체가 아니라 띠 높이만큼만 떠 둔다(전체 스냅샷은 아이패드에서 수십 ms).
        const dpr = dprRef.current;
        const y = Math.max(0, Math.floor((band.top - 2) * dpr));
        const h = Math.min(canvas.height - y, Math.ceil((band.height + 4) * dpr));
        if (h > 0) {
          hlSnapY.current = y;
          hlSnap.current = ctx.getImageData(0, y, canvas.width, h);
        }
      }
      capture(e);
      return;
    }
    drawing.current = true;
    last.current = p;
    // 실제로 그려진 게 없으면(탭만 하고 뗌) 되돌리기 이력도 남기지 않는다.
    strokeBox.current = null;
    capture(e);
  }

  // 획이 캔버스에 남기는 최대 반경(선 굵기 절반 + 여유).
  function strokeRadius() {
    return (tool === "eraser" ? eraserWidth : width * 1.5) / 2 + 2;
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    const p = pos(e);
    if (tool === "eraser") showEraserCursor(p.x, p.y);
    if (tool === "ocr") {
      if (!selStart.current || !selRef.current) return;
      const s = selStart.current;
      selRef.current.style.left = `${Math.min(s.x, p.x)}px`;
      selRef.current.style.top = `${Math.min(s.y, p.y)}px`;
      selRef.current.style.width = `${Math.abs(p.x - s.x)}px`;
      selRef.current.style.height = `${Math.abs(p.y - s.y)}px`;
      return;
    }
    if (tool === "highlight") {
      if (!drawing.current) return;
      paintHighlight(p.x);
      return;
    }
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const eraser = tool === "eraser";
    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = eraserWidth;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
    }
    // 브라우저가 한 프레임에 몰아 준 중간 지점까지 모두 그린다. 빠르게 쓸 때
    // 이벤트가 합쳐지면서 획 일부가 잘려 보이던 문제를 막는다.
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    const steps = native.getCoalescedEvents?.() ?? [];
    const moves = steps.length > 0 ? steps : [e.nativeEvent as PointerEvent];
    const r = strokeRadius();
    markBox(last.current.x, last.current.y, r);
    for (const m of moves) {
      const q = point(m.clientX, m.clientY);
      if (!eraser) {
        // 필압은 구간마다 달라지므로 구간 단위로 그린다.
        const pressure = m.pressure && m.pressure > 0 ? m.pressure : 0.5;
        ctx.lineWidth = width * (0.5 + pressure);
      }
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      markBox(q.x, q.y, r);
      last.current = q;
    }
    ctx.globalAlpha = 1;
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
    if (tool === "highlight") {
      if (!drawing.current) return;
      // 클릭만 하고 끌지 않았으면(러버밴드 미변경) 취소하고 스냅샷 복원.
      if (hlSnap.current) paintHighlight(pos(e).x);
      drawing.current = false;
      hlSnap.current = null;
      hlBand.current = null;
      rectRef.current = null;
      commitStroke();
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    rectRef.current = null;
    commitStroke();
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
        onPointerEnter={(e) => { if (tool === "eraser" && e.pointerType !== "touch") { const p = pos(e); showEraserCursor(p.x, p.y); } }}
        onPointerLeave={hideEraserCursor}
        style={{
          position: "absolute",
          inset: 0,
          touchAction: "pan-y",
          cursor: tool === "eraser" ? "none" : "crosshair",
          opacity: sized ? 1 : 0,
        }}
      />
      {/* 지우개 영역 표시 커서 */}
      <div
        ref={eraserCurRef}
        style={{
          position: "absolute", display: "none", pointerEvents: "none",
          transform: "translate(-50%, -50%)", borderRadius: "50%",
          border: "1.5px solid #6B7280", background: "rgba(148,163,184,0.25)", zIndex: 5,
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
  const [eraserWidth, setEraserWidth] = useState(22);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // 현재 보고 있는 페이지의 되돌리기/앞으로 가능 여부(버튼 활성 표시용).
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  // 제목 옆 chevron으로 여는 문제/해설 드롭다운.
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  // 바깥을 누르면 닫히도록.
  useEffect(() => {
    if (!sectionMenuOpen) return;
    const close = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mock-section-menu") || t?.closest?.("[aria-expanded]")) return;
      setSectionMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [sectionMenuOpen]);
  const [section, setSection] = useState<"problem" | "solution">("problem");
  const pageRefs = useRef<(PageHandle | null)[]>([]);
  const activePage = useRef(0);

  const hasSolution = exam.solutionImageUrls.length > 0;
  const pages = section === "solution" ? exam.solutionImageUrls : exam.imageUrls;
  const pageLines = section === "solution" ? exam.solutionLineBoxes : exam.lineBoxes;

  // 손가락 핀치 확대/축소. 내부 스크롤 컨테이너(네이티브 스크롤=관성 유지)에
  // content를 CSS scale로 확대하고, sizer로 확대된 만큼 스크롤 영역을 확보한다.
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinch = useRef<{
    active: boolean; startDist: number; startZoom: number;
    contentX: number; contentY: number;
  }>({ active: false, startDist: 0, startZoom: 1, contentX: 0, contentY: 0 });

  // content 너비 = 뷰포트 너비(고정), sizer = content 자연 크기 × zoom.
  // content 너비를 sizer 퍼센트로 두면 확대→sizer↑→content↑ 피드백 루프가 생기므로
  // 반드시 뷰포트 기준 고정 px로 잡는다.
  function syncSizer(z: number) {
    const content = contentRef.current;
    const sizer = sizerRef.current;
    const sc = scrollRef.current;
    if (!content || !sizer || !sc) return;
    const baseW = sc.clientWidth;
    content.style.width = `${baseW}px`;
    sizer.style.width = `${baseW * z}px`;
    sizer.style.height = `${content.offsetHeight * z}px`;
  }

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    syncSizer(zoom);
  }, [zoom]);

  // 이미지 로드로 content 자연 높이가 바뀌거나 뷰포트가 리사이즈되면 sizer 갱신.
  useEffect(() => {
    const content = contentRef.current;
    const onResize = () => syncSizer(zoomRef.current);
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | undefined;
    if (content && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => syncSizer(zoomRef.current));
      ro.observe(content);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);

  // 핀치 제스처(두 손가락). 스타일러스가 섞이면 필기이므로 무시.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const hasStylus = (t: TouchList) =>
      Array.from(t).some((x) => (x as Touch & { touchType?: string }).touchType === "stylus");

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || hasStylus(e.touches)) return;
      const r = el.getBoundingClientRect();
      const m = mid(e.touches);
      const z = zoomRef.current;
      pinch.current = {
        active: true,
        startDist: dist(e.touches),
        startZoom: z,
        // 핀치 시작 midpoint가 가리키는 content 좌표(확대 기준점).
        contentX: (el.scrollLeft + (m.x - r.left)) / z,
        contentY: (el.scrollTop + (m.y - r.top)) / z,
      };
    };
    const onMoveT = (e: TouchEvent) => {
      if (!pinch.current.active || e.touches.length !== 2) return;
      e.preventDefault();
      const p = pinch.current;
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (p.startZoom * dist(e.touches)) / p.startDist));
      const r = el.getBoundingClientRect();
      const m = mid(e.touches);
      setZoom(nz);
      syncSizer(nz);
      // 핀치 시작점의 content 좌표가 현재 midpoint 아래 유지되도록 스크롤 보정.
      el.scrollLeft = p.contentX * nz - (m.x - r.left);
      el.scrollTop = p.contentY * nz - (m.y - r.top);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current.active = false;
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMoveT, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMoveT);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  function resetZoom() {
    setZoom(1);
    const el = scrollRef.current;
    if (el) { el.scrollLeft = 0; }
  }

  // 문제↔해설 탭 전환: 페이지 refs/스크롤/줌 초기화(다른 이미지 세트로 교체).
  function switchSection(s: "problem" | "solution") {
    if (s === section) return;
    setSection(s);
    pageRefs.current = [];
    activePage.current = 0;
    setHist({ canUndo: false, canRedo: false });
    resetZoom();
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }

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
  const eraserPreview = Math.round(10 + ((eraserWidth - 8) / 52) * 16); // 10~26px 미리보기 원

  // 굿노트풍 도구 아이콘 버튼(선택 시 연한 배경 + 진한 아이콘).
  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => {
    const on = tool === t;
    return (
      <button
        type="button"
        onClick={() => setTool(t)}
        aria-label={label}
        title={label}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 36, borderRadius: 9, border: "none", flexShrink: 0,
          background: on ? "#E9ECF1" : "transparent",
          color: on ? "#191F28" : "#8B95A1",
          cursor: "pointer", padding: 0,
          transition: "background 0.15s ease, color 0.15s ease",
        }}
      >
        {icon}
      </button>
    );
  };

  const divider = (
    <span aria-hidden style={{ width: 1, height: 22, background: "#E5E8EB", flexShrink: 0, margin: "0 2px" }} />
  );

  // 펜/형광펜 굵기 프리셋(굿노트처럼 얇게·보통·굵게).
  const widthPresets = tool === "highlight" ? [12, 18, 26] : [2, 4, 7];

  return (
    <div style={{ height: "100dvh", background: "#EDEFF2", display: "flex", flexDirection: "column" }}>
      {/* 상단 바 — 시험지 제목/문서 액션 */}
      <div
        style={{
          position: "relative",
          flexShrink: 0, zIndex: 21, background: "#41444B",
          padding: "calc(env(safe-area-inset-top, 0px) + 7px) 10px 7px",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <button type="button" onClick={() => router.back()} aria-label="뒤로" style={barBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {/* 제목: 좌우 버튼 개수와 무관하게 항상 화면 정중앙 */}
        <div
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            top: "calc(env(safe-area-inset-top, 0px) + 7px)", height: 34,
            display: "flex", alignItems: "center", maxWidth: "58%",
          }}
        >
          <button
            type="button"
            onClick={() => setSectionMenuOpen((v) => !v)}
            aria-expanded={sectionMenuOpen}
            aria-label="문제/해설 전환"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%",
              height: 34, padding: "0 10px", borderRadius: 9, border: "none",
              background: sectionMenuOpen ? "rgba(255,255,255,0.14)" : "transparent",
              cursor: "pointer",
              transition: "background 0.16s ease",
            }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {exam.title}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C9CDD4", flexShrink: 0 }}>
              {section === "solution" ? "해설" : "문제"}
            </span>
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9CDD4" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transform: sectionMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {sectionMenuOpen && (
            <div
              className="mock-section-menu"
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: "50%",
                transformOrigin: "top center",
                minWidth: 176, background: "#fff", borderRadius: 14, padding: 6,
                boxShadow: "0 16px 40px rgba(15,23,42,0.28)", zIndex: 40,
              }}
            >
              {([["problem", "문제"], ["solution", "해설보기"]] as const).map(([s2, lbl]) => {
                const on = section === s2;
                const disabled = s2 === "solution" && !hasSolution;
                return (
                  <button
                    key={s2}
                    type="button"
                    onClick={() => { switchSection(s2); setSectionMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: on ? "#F1F3F5" : "transparent",
                      color: disabled ? "#B0B8C1" : "#191F28",
                      fontSize: 14, fontWeight: on ? 800 : 600, textAlign: "left",
                    }}
                  >
                    <span style={{ width: 16, flexShrink: 0, color: "#3787FF", fontWeight: 900 }}>{on ? "✓" : ""}</span>
                    {lbl}
                    {disabled && <span style={{ marginLeft: "auto", fontSize: 11, color: "#B0B8C1", fontWeight: 700 }}>없음</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span style={{ flex: 1 }} />
        {zoom > 1.01 && (
          <button type="button" onClick={resetZoom} aria-label="확대 초기화"
            style={{ ...barBtn, width: "auto", padding: "0 9px", color: "#fff", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(zoom * 100)}%
          </button>
        )}
        <button
          type="button"
          onClick={() => { pageRefs.current[activePage.current]?.undo(); }}
          disabled={!hist.canUndo}
          aria-label="되돌리기" title="되돌리기"
          style={{ ...barBtn, opacity: hist.canUndo ? 1 : 0.35, cursor: hist.canUndo ? "pointer" : "default" }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => { pageRefs.current[activePage.current]?.redo(); }}
          disabled={!hist.canRedo}
          aria-label="앞으로" title="앞으로"
          style={{ ...barBtn, opacity: hist.canRedo ? 1 : 0.35, cursor: hist.canRedo ? "pointer" : "default" }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 4 21 9 16 9" />
          </svg>
        </button>
      </div>

      {/* 도구 바 — 펜/형광펜/지우개/OCR · 색상 · 굵기 */}
      <div
        style={{
          flexShrink: 0, zIndex: 20, background: "#fff", borderBottom: "1px solid #E5E8EB",
          padding: "6px 10px",
          display: "flex", alignItems: "center", gap: 3,
          overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
        }}
      >
        {toolBtn("pen", "펜",
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
          </svg>)}
        {toolBtn("highlight", "형광펜",
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l-4 4v3h3l4-4" /><path d="M14.5 3.5l6 6-8 8-6-6 8-8z" /><path d="M3 21h8" />
          </svg>)}
        {toolBtn("eraser", "지우개",
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16.5L12.5 8a2.5 2.5 0 0 1 3.5 0l3.5 3.5a2.5 2.5 0 0 1 0 3.5L14 20H7l-3-3.5z" /><path d="M9 20h11" />
          </svg>)}
        {toolBtn("ocr", "글자 인식",
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M8 8h8" /><path d="M12 8v8" />
          </svg>)}

        {(tool === "pen" || tool === "highlight") && (
          <>
            {divider}
            {colors.map((c) => {
              const on = activeColor === c;
              return (
                <button
                  key={c} type="button" onClick={() => setActiveColor(c)} aria-label={`색상 ${c}`}
                  style={{
                    width: 30, height: 30, borderRadius: 999, flexShrink: 0, padding: 0, cursor: "pointer",
                    background: c,
                    border: on ? "2.5px solid #fff" : "1px solid rgba(15,23,42,0.10)",
                    boxShadow: on ? `0 0 0 2px ${c}` : "none",
                    transition: "box-shadow 0.15s ease",
                  }}
                />
              );
            })}
            {divider}
            {widthPresets.map((w) => {
              const on = tool === "pen" ? width === w : false;
              return (
                <button
                  key={w} type="button"
                  onClick={() => tool === "pen" && setWidth(w)}
                  aria-label={`굵기 ${w}`}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 34, borderRadius: 9, border: "none", flexShrink: 0, cursor: "pointer",
                    background: on ? "#E9ECF1" : "transparent", padding: 0,
                  }}
                >
                  <span style={{ display: "block", width: 20, height: Math.max(2, Math.round(w * 0.9)), borderRadius: 999, background: on ? "#191F28" : "#8B95A1" }} />
                </button>
              );
            })}
          </>
        )}

        {tool === "eraser" && (
          <>
            {divider}
            <span aria-hidden style={{ display: "inline-flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ display: "inline-block", width: eraserPreview, height: eraserPreview, borderRadius: "50%", background: "#CBD2DA", border: "1px solid #AEB6C0" }} />
            </span>
            <input type="range" min={8} max={60} value={eraserWidth} onChange={(e) => setEraserWidth(Number(e.target.value))} style={{ width: 104, flexShrink: 0 }} aria-label="지우개 크기" />
            {divider}
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer",
                border: "1px solid #FBD5D5", background: "#FFF5F5", color: "#E03131",
                fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" />
              </svg>
              전체 삭제
            </button>
          </>
        )}

        {tool === "ocr" && (
          <span style={{ marginLeft: 6, fontSize: 12, color: "#8B95A1", fontWeight: 600, whiteSpace: "nowrap" }}>
            글자 영역을 드래그하세요
          </span>
        )}
      </div>

      <style>{`
        .mock-section-menu {
          animation: mockSectionMenuIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes mockSectionMenuIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mock-section-menu { animation: none; transform: translateX(-50%); }
        }
      `}</style>

      {/* 페이지들 (내부 스크롤 + 핀치 확대) */}
      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      >
        <div ref={sizerRef} style={{ transformOrigin: "0 0" }}>
          <div
            ref={contentRef}
            style={{ transformOrigin: "0 0", transform: `scale(${zoom})` }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 8px 40px" }}>
              {pages.length === 0 ? (
                <p style={{ textAlign: "center", color: "#8A909C", padding: 40 }}>
                  {section === "solution" ? "이 시험지는 아직 해설이 등록되지 않았어요." : "등록된 시험지 이미지가 없습니다."}
                </p>
              ) : (
                pages.map((url, i) => (
                  <PageCanvas
                    key={`${section}-${url}`}
                    ref={(el) => { pageRefs.current[i] = el; }}
                    examId={exam.id}
                    section={section}
                    pageIndex={i}
                    imageUrl={url}
                    lines={pageLines?.[i] ?? []}
                    tool={tool}
                    color={activeColor}
                    width={width}
                    eraserWidth={eraserWidth}
                    onActive={() => { activePage.current = i; }}
                    onOcrRegion={runOcr}
                    onHistoryChange={(h) => { if (activePage.current === i) setHist(h); }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 페이지 지우기 확인 모달 (WebView는 window.confirm 미동작 → 인앱 모달) */}
      {showClearConfirm && (
        <div
          onClick={() => setShowClearConfirm(false)}
          style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, background: "#fff", borderRadius: 18, padding: "22px 20px 16px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#191F28", margin: "0 0 6px", textAlign: "center" }}>페이지 지우기</p>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 20px", textAlign: "center", lineHeight: 1.5 }}>이 페이지의 필기를 모두 지울까요?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setShowClearConfirm(false)} style={{ flex: 1, height: 48, borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff", color: "#4B5563", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>취소</button>
              <button type="button" onClick={() => { pageRefs.current[activePage.current]?.clear(); setShowClearConfirm(false); }} style={{ flex: 1, height: 48, borderRadius: 12, border: "none", background: "#EF4444", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>확인</button>
            </div>
          </div>
        </div>
      )}

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

// 상단 다크 바의 아이콘 버튼.
const barBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 34, borderRadius: 9, flexShrink: 0,
  border: "none", background: "transparent", cursor: "pointer", padding: 0,
};
