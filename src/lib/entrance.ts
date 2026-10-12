"use client";

import { useEffect, useState } from "react";

/**
 * 프리티풀 퀵매칭 등장(useTabEntrance 이식) — 화면에 **들어올 때만** 차례로 떠오르게 한다.
 *  · 처음 로드(하이드레이션)는 서버 HTML 과 맞추려고 늘 재생한다.
 *  · 그 뒤 화면을 옮겨 다닐 때: 뒤로가기(popstate 1.5초 안)이거나, 그 화면을 떠난 지 30초가 안 됐으면 생략한다.
 * 사용: const play = useEntrance("bookmarks"); <div className={play ? "qd-body" : undefined}>
 */
let hydrated = false;
let lastPop = 0;
const LEFT_KEY = (k: string) => `tab-entrance-left:${k}`;
const SKIP_WITHIN_MS = 30_000;

/** 루트에서 한 번 불러, 이후 마운트는 '화면 이동'으로 본다 */
export function markEntranceReady() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  window.addEventListener("popstate", () => {
    lastPop = Date.now();
  });
}

function shouldPlay(key: string): boolean {
  if (!hydrated) return true;
  if (Date.now() - lastPop < 1500) return false;
  try {
    const left = Number(sessionStorage.getItem(LEFT_KEY(key)));
    if (left && Date.now() - left < SKIP_WITHIN_MS) return false;
  } catch {
    /* 저장소가 막혔으면 그냥 재생 */
  }
  return true;
}

export function useEntrance(key: string): boolean {
  const [play] = useState(() => shouldPlay(key));
  useEffect(() => {
    const mark = () => {
      try {
        sessionStorage.setItem(LEFT_KEY(key), String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", mark);
    return () => {
      window.removeEventListener("pagehide", mark);
      mark();
    };
  }, [key]);
  return play;
}
