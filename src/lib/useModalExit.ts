"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 모달이 '뚝' 사라지지 않게 — 닫기 동작을 바로 실행하지 않고 내려가는 연출(.is-leaving)을 먼저 보인 뒤 실행한다.
 * 프리티풀 AnimatePresence(스프링 등장/내려가며 닫힘)를 CSS 로 옮긴 것.
 *   const { leaving, exit } = useModalExit();
 *   <div className={`mdl-root${leaving ? " is-leaving" : ""}`}> … onClick={() => exit(close)}
 */
export const MODAL_EXIT_MS = 220;

export function useModalExit() {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const exit = useCallback((after?: () => void) => {
    if (timer.current) return; // 이미 내려가는 중
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      after?.();
    }, MODAL_EXIT_MS);
  }, []);
  return { leaving, exit };
}
