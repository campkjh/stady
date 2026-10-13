"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * 퀴즈 풀이 화면의 "양옆 화면을 눌러 이전/다음 문제로 넘기기" 설정.
 *  · 기본은 켜짐. 끄면 화살표 버튼·스와이프로만 넘어간다.
 *  · 좋은 문제를 복사하거나 긴 해설을 읽다가 의도치 않게 넘어간다는 사용자 신고로 끌 수 있게 했다.
 *  · 기기에 저장(localStorage)하고, 같은 화면 안의 여러 컴포넌트(헤더 토글 + 탭 영역)가 같은 값을 보게 이벤트로 동기화한다.
 *  · 저장소가 막힌 환경(시크릿 등)에서는 이번 화면 동안만 유지된다.
 */
const KEY = "stady_side_tap_off";
const EVENT = "stady:side-tap";

let memoryOff = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return !memoryOff;
  }
}

export function useSideTap(): [boolean, (on: boolean) => void] {
  // 서버 HTML 과 맞추려고 처음엔 켜짐으로 두고, 마운트 직후 저장값을 읽는다.
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(read());
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    memoryOff = !next;
    try {
      if (next) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "1");
    } catch {
      /* 저장 실패 — 메모리 값으로 이번 화면만 */
    }
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [on, set];
}
