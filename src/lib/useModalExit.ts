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
  // 같은 컴포넌트가 모달을 닫았다가 다시 여는 경우(훅이 계속 살아 있음) 열기 전에 불러 '닫히는 중' 표시를 지운다.
  // 안 지우면 다시 연 모달이 .is-leaving 인 채 그려져 투명하게 내려가 버려 "눌러도 안 열린다"가 된다
  // (퀴즈 노트 저장 뒤 다시 안 열리던 제보). 닫기 콜백에서 자동으로 지우지 않는 건, 화면 이동만 하고
  // 모달을 숨기지 않는 콜백(공지 전체보기·뒤로가기 등)에서 이동 중에 모달이 다시 보이지 않게 하려는 것.
  const reset = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setLeaving(false);
  }, []);
  return { leaving, exit, reset };
}
