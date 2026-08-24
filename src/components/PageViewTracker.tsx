"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// 페이지 체류 수집기.
// 경로가 바뀌거나(usePathname), 탭이 백그라운드로 가거나(visibilitychange),
// 페이지를 떠날 때(pagehide) "직전 경로에 실제로 머문 시간"을 서버로 던진다.
//
// 원칙
//  - 백그라운드 시간은 체류에서 뺀다. 탭만 켜두고 딴짓한 시간이 최고 기록이 되면
//    데이터가 의미를 잃는다. → foreground 구간만 누적한다.
//  - 3초 미만은 스쳐 지나간 것이라 버리고, 30분을 넘으면 30분으로 자른다.
//  - 전송은 sendBeacon 우선(언로드 중에도 살아남는다), 없으면 fetch keepalive.
//  - 실패는 전부 조용히 무시한다. 어떤 경우에도 페이지 동작에 영향을 주면 안 된다.
const ENDPOINT = "/api/pageview";
const MIN_DWELL_MS = 3_000;
const MAX_DWELL_MS = 30 * 60 * 1000;

export default function PageViewTracker() {
  const pathname = usePathname();

  const pathRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0); // 이번 구간 진입 시각(벽시계)
  const visibleSinceRef = useRef<number | null>(null); // 지금 이어지는 foreground 구간의 시작
  const foregroundMsRef = useRef<number>(0); // 확정된 foreground 누적 시간

  const send = useCallback((path: string, dwellMs: number, startedAt: number) => {
    try {
      const body = JSON.stringify({
        path,
        dwellMs,
        startedAt: new Date(startedAt).toISOString(),
      });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        // sendBeacon 은 큐가 가득 차면 false 를 준다. 그때만 fetch 로 내려간다.
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {});
    } catch {
      // 수집은 부가 기능이다. 실패해도 아무 일도 일어나지 않아야 한다.
    }
  }, []);

  // 새 구간 시작. 지금 화면이 보이는 상태일 때만 foreground 타이머를 켠다
  // (백그라운드에서 라우팅이 일어난 경우엔 꺼진 채로 둔다).
  const beginVisit = useCallback((path: string | null) => {
    pathRef.current = path;
    startedAtRef.current = Date.now();
    foregroundMsRef.current = 0;
    visibleSinceRef.current =
      typeof document !== "undefined" && document.visibilityState === "visible" ? Date.now() : null;
  }, []);

  // 진행 중이던 foreground 구간을 누적에 반영하고 타이머를 끈다.
  const foldForeground = useCallback(() => {
    if (visibleSinceRef.current !== null) {
      foregroundMsRef.current += Date.now() - visibleSinceRef.current;
      visibleSinceRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    foldForeground();
    const path = pathRef.current;
    const dwell = foregroundMsRef.current;
    const startedAt = startedAtRef.current;

    if (path && dwell >= MIN_DWELL_MS) {
      send(path, Math.min(dwell, MAX_DWELL_MS), startedAt);
    }
    // 보냈든 버렸든 카운터는 리셋한다. 같은 경로에 계속 머무는 경우 다음 구간이
    // 새로 쌓이므로 이중 집계가 없고, hidden 직후 이어지는 pagehide 는 0ms 라 저절로 버려진다.
    startedAtRef.current = Date.now();
    foregroundMsRef.current = 0;
    visibleSinceRef.current = null;
  }, [foldForeground, send]);

  // 경로 변경: cleanup 이 "이전 경로"의 체류를 확정해 보낸다.
  // (레이아웃 자체가 언마운트될 때 — 이 그룹 밖으로 나갈 때 — 도 여기서 확정된다.)
  useEffect(() => {
    if (!pathname) return;
    beginVisit(pathname);
    return () => {
      flush();
    };
  }, [pathname, beginVisit, flush]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // 백그라운드 진입 = 체류 종료. 여기서 보내야 탭을 그대로 닫아도 남는다.
        flush();
      } else if (visibleSinceRef.current === null) {
        // 복귀 = foreground 타이머 재개. 그 사이 백그라운드에 있던 시간은 누적되지 않았다.
        visibleSinceRef.current = Date.now();
      }
    };
    const onPageHide = () => flush();
    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache 복원은 새 방문으로 친다(뒤로가기로 돌아온 화면).
      if (event.persisted) beginVisit(pathRef.current);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [beginVisit, flush]);

  return null;
}
