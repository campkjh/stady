"use client";

import { useLayoutEffect, useRef, useState } from "react";

/*
 * 토스 말풍선 바탕 — 프리티풀 홈 퀵매칭 말풍선(components/home/TossBubble.tsx)을 그대로 옮겼다.
 * 꼬리와 몸통을 **한 장**으로 잘라 쓴다. 둘을 따로 흐리면 각자 뒤를 따로 흐려서
 * 만나는 자리에 색이 툭 끊긴 선이 생긴다.
 * 여기선 꼬리가 아래로 가는 판(side="bottom")을 기본으로 쓴다 — 말풍선이 대상 위에 뜨기 때문.
 */

/** 꼬리 높이·몸통 모서리(토스 실측) — globals .qm-bubble-body 여백과 같게 */
export const QM_TAIL_H = 13;
export const QM_RADIUS = 26;

const n = (v: number) => Math.round(v * 100) / 100;

/** 꼬리가 위로 붙은 윤곽(대상이 말풍선 아래에 있을 때). */
export function bubblePathTop(w: number, h: number, tailX: number) {
  const t = QM_TAIL_H;
  const r = Math.min(QM_RADIUS, (h - t) / 2);
  const x = Math.min(Math.max(tailX, r + 14), w - r - 14);
  return [
    `M${n(r)} ${t}`,
    `L${n(x - 14)} ${t}`,
    `C${n(x - 11.4)} ${t} ${n(x - 10.7)} ${n(t - 1.8)} ${n(x - 9.8)} ${n(t - 2.9)}`,
    `L${n(x - 3.9)} ${n(t - 10.2)}`,
    `Q${n(x)} ${n(t - 14.6)} ${n(x + 3.9)} ${n(t - 10.2)}`,
    `L${n(x + 9.8)} ${n(t - 2.9)}`,
    `C${n(x + 10.7)} ${n(t - 1.8)} ${n(x + 11.4)} ${t} ${n(x + 14)} ${t}`,
    `L${n(w - r)} ${t}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w)} ${n(t + r)}`,
    `L${n(w)} ${n(h - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(h)}`,
    `L${n(r)} ${n(h)}`,
    `A${n(r)} ${n(r)} 0 0 1 0 ${n(h - r)}`,
    `L0 ${n(t + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(r)} ${t}`,
    "Z",
  ].join("");
}

/** 꼬리가 아래로 붙은 윤곽 — 위 꼬리를 위아래로 뒤집었다(대상이 말풍선 아래). */
export function bubblePathBottom(w: number, h: number, tailX: number) {
  const t = QM_TAIL_H;
  const b = h - t; // 몸통 아랫변
  const r = Math.min(QM_RADIUS, b / 2);
  const x = Math.min(Math.max(tailX, r + 14), w - r - 14);
  return [
    `M${n(r)} 0`,
    `L${n(w - r)} 0`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w)} ${n(r)}`,
    `L${n(w)} ${n(b - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(b)}`,
    `L${n(x + 14)} ${n(b)}`,
    `C${n(x + 11.4)} ${n(b)} ${n(x + 10.7)} ${n(b + 1.8)} ${n(x + 9.8)} ${n(b + 2.9)}`,
    `L${n(x + 3.9)} ${n(b + 10.2)}`,
    `Q${n(x)} ${n(b + 14.6)} ${n(x - 3.9)} ${n(b + 10.2)}`,
    `L${n(x - 9.8)} ${n(b + 2.9)}`,
    `C${n(x - 10.7)} ${n(b + 1.8)} ${n(x - 11.4)} ${n(b)} ${n(x - 14)} ${n(b)}`,
    `L${n(r)} ${n(b)}`,
    `A${n(r)} ${n(r)} 0 0 1 0 ${n(b - r)}`,
    `L0 ${n(r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0`,
    "Z",
  ].join("");
}

/**
 * 말풍선 바탕 유리. 제 크기를 재서(ResizeObserver) 윤곽으로 잘라 쓴다 — 재기 전엔 숨긴다.
 */
export function TossBubbleGlass({
  tailX = 0,
  side = "bottom",
}: {
  tailX?: number;
  side?: "top" | "bottom";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const clip = size
    ? `path('${side === "bottom" ? bubblePathBottom(size.w, size.h, tailX) : bubblePathTop(size.w, size.h, tailX)}')`
    : undefined;
  return (
    <span
      ref={ref}
      className="qm-bubble-glass"
      aria-hidden="true"
      style={{ clipPath: clip, WebkitClipPath: clip, visibility: size ? undefined : "hidden" }}
    />
  );
}
