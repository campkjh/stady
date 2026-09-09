"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

/**
 * 소프트 키보드(또는 하단 브라우저 UI)가 바텀시트를 덮은 높이(px). 안 덮으면 0.
 *
 * 안드로이드 WebView(갤럭시)는 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않는 일이 많다.
 * position:fixed 는 그 레이아웃 뷰포트가 기준이라, 하단에 붙인 시트가 통째로 키보드 뒤로
 * 숨는다(= 메모지가 안 보이고 끌어올릴 수도 없던 원인).
 *
 * 기준 높이를 innerHeight 로 어림하면 브라우저마다 값이 달라 덜 올라간다. 그래서 시트를 감싼
 * 고정 오버레이(top:0·bottom:0)의 실제 아래쪽 좌표를 재고, visualViewport 가 알려주는
 * '실제 보이는 영역의 아래쪽'과의 차이를 그대로 쓴다. 오버레이 높이는 자기 padding 에
 * 영향받지 않으므로(테두리 상자 고정) 되먹임도 없다.
 *
 * 키보드가 뜰 때 뷰포트를 줄여주는 환경(안드 adjustResize·데스크톱)에서는 0 이라 아무것도 안 바뀐다.
 */
const IGNORE_BELOW_PX = 80; // 주소창 여닫힘 같은 자잘한 차이는 키보드로 치지 않는다.

/**
 * iOS(WKWebView·사파리)는 키보드가 뜨면 position:fixed 요소를 알아서 키보드 위로 올려준다.
 * 그런데 그 이동이 getBoundingClientRect 에도 visualViewport.offsetTop 에도 안 잡혀서,
 * 여기서 또 올리면 두 번 올라가 시트가 화면 위로 잘려 나간다(2026-09-09 아이폰 제보).
 * 실제로 안 올려주는 건 안드로이드뿐이라 그쪽에서만 보정한다.
 */
function needsManualLift(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function readInset(el: HTMLElement | null): number {
  if (!needsManualLift()) return 0;
  const vv = typeof window === "undefined" ? null : window.visualViewport;
  if (!vv || !el) return 0; // 구형 WebView(미지원)·마운트 전이면 기존 동작 그대로
  const overlayBottom = el.getBoundingClientRect().bottom; // 고정 요소 기준 화면 아래
  const visibleBottom = vv.offsetTop + vv.height; // 실제로 보이는 영역 아래
  const overlap = overlayBottom - visibleBottom;
  return overlap > IGNORE_BELOW_PX ? Math.round(overlap) : 0;
}

export function useKeyboardInset(active: boolean, overlayRef: RefObject<HTMLElement | null>): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = active && typeof window !== "undefined" ? window.visualViewport : null;
      if (!vv) return () => {};
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      // 입력창을 누르는 순간(포커스)과 키보드 애니메이션이 끝난 뒤 한 번 더 잰다.
      // 시트를 열 때 이미 키보드가 올라와 있으면 resize 가 안 오는 경우가 있다.
      window.addEventListener("focusin", onChange);
      const timers = [setTimeout(onChange, 150), setTimeout(onChange, 450)];
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
        window.removeEventListener("focusin", onChange);
        timers.forEach(clearTimeout);
      };
    },
    [active]
  );
  const getSnapshot = useCallback(
    () => (active ? readInset(overlayRef.current) : 0),
    [active, overlayRef]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
