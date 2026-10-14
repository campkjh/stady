"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// 사파리처럼 화면 왼쪽 끝에서 오른쪽으로 밀면 뒤로 간다(상세 페이지 전용).
//  · 하단 네비에 있는 탭 화면(홈·커뮤니티·타이머·책갈피·마이홈)과 어드민·로그인에서는 꺼 둔다.
//  · iOS 앱(WKWebView)의 시스템 뒤로 제스처는 이 앱에서 동작하지 않아(2026-10 아이폰 제보) iOS 에서도 같은 코드로 처리한다.
//    시스템 제스처가 먼저 터치를 가져가면 touchcancel 이 오고, 그 경우 뒤로 가지 않고 되돌리므로 두 번 뒤로 가진 않는다.
//  · 화면(body)이 손가락을 따라 오른쪽으로 밀려나고, 놓았을 때 1/3 이상 밀었거나 빠르게 휘둘렀으면 뒤로 간다.
//
// 밀 때 position:fixed 요소(고정 헤더·FAB·하단 네비)가 body 의 transform 때문에 스크롤 양만큼 어긋나므로,
// 제스처가 시작되면 body 를 화면 크기로 고정하고 스크롤 양을 body.scrollTop 으로 옮겨 둔다(globals.css .swb-active).
// 끝나면 원래대로 되돌리고 스크롤 위치를 복원한다.

const TAB_ROOTS = new Set(["/", "/community", "/timer", "/bookmarks", "/mypage"]);
const EDGE_PX = 24; // 이 안쪽에서 시작한 터치만 인정
const SLOP_PX = 8; // 가로로 이만큼 움직여야 제스처로 확정
const COMMIT_RATIO = 0.33;
const COMMIT_VELOCITY = 0.45; // px/ms
const ANIM_MS = 280;
const BACK_TIMEOUT_MS = 1200; // 뒤로 갈 곳이 없어 경로가 안 바뀌면 되돌린다

function isDetailPath(path: string): boolean {
  if (TAB_ROOTS.has(path)) return false;
  if (path.startsWith("/admin") || path.startsWith("/login")) return false;
  return true;
}

type Phase = "idle" | "track" | "drag" | "settling" | "leaving";

export default function EdgeSwipeBack() {
  const pathname = usePathname();
  const router = useRouter();
  const enabledRef = useRef(false);
  const leavingDoneRef = useRef<(() => void) | null>(null);
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // 경로가 바뀌면: 이 화면이 상세인지 갱신 + 뒤로 가는 중이었다면 정리
  useEffect(() => {
    enabledRef.current = isDetailPath(pathname);
    leavingDoneRef.current?.();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const st = {
      phase: "idle" as Phase,
      x0: 0,
      y0: 0,
      dx: 0,
      lastX: 0,
      lastT: 0,
      v: 0,
      scrollY: 0,
      w: 0,
      timer: 0,
    };

    const cleanup = (restoreScroll: boolean) => {
      window.clearTimeout(st.timer);
      html.classList.remove("swb-active");
      body.style.transform = "";
      body.style.transition = "";
      if (restoreScroll) window.scrollTo(0, st.scrollY);
      st.phase = "idle";
      st.dx = 0;
      leavingDoneRef.current = null;
    };

    const animateTo = (x: number, done: () => void) => {
      body.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      body.style.transform = `translate3d(${x}px, 0, 0)`;
      st.timer = window.setTimeout(done, ANIM_MS);
    };

    const begin = () => {
      st.scrollY = window.scrollY;
      st.w = window.innerWidth;
      html.classList.add("swb-active");
      body.scrollTop = st.scrollY; // body 가 스크롤 컨테이너가 됐으니 보던 자리를 그대로 옮긴다
      st.phase = "drag";
    };

    const onStart = (e: TouchEvent) => {
      if (st.phase !== "idle" || !enabledRef.current || e.touches.length !== 1) return;
      if (window.history.length <= 1) return;
      if (body.style.position === "fixed") return; // 모달이 body 를 잠근 상태
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      st.phase = "track";
      st.x0 = t.clientX;
      st.y0 = t.clientY;
      st.lastX = t.clientX;
      st.lastT = e.timeStamp;
      st.v = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (st.phase !== "track" && st.phase !== "drag") return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - st.x0;
      const dy = t.clientY - st.y0;
      if (st.phase === "track") {
        if (Math.abs(dy) > SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
          st.phase = "idle"; // 세로 스크롤 — 제스처 아님
          return;
        }
        if (dx < SLOP_PX) return;
        begin();
      }
      if (e.cancelable) e.preventDefault();
      st.dx = Math.max(0, dx);
      const dt = e.timeStamp - st.lastT;
      if (dt > 0) st.v = 0.8 * st.v + 0.2 * ((t.clientX - st.lastX) / dt);
      st.lastX = t.clientX;
      st.lastT = e.timeStamp;
      body.style.transform = `translate3d(${st.dx}px, 0, 0)`;
    };

    const onEnd = (e: TouchEvent) => {
      if (st.phase === "track") {
        st.phase = "idle";
        return;
      }
      if (st.phase !== "drag") return;
      const commit = e.type !== "touchcancel" && (st.dx > st.w * COMMIT_RATIO || st.v > COMMIT_VELOCITY);
      if (!commit) {
        st.phase = "settling";
        animateTo(0, () => cleanup(true));
        return;
      }
      st.phase = "leaving";
      animateTo(st.w, () => {
        // 경로가 바뀌면 usePathname 효과가 leavingDoneRef 를 불러 정리한다.
        leavingDoneRef.current = () => cleanup(false);
        routerRef.current.back();
        // 뒤로 갈 곳이 없어 그대로면 제자리로 되돌린다.
        st.timer = window.setTimeout(() => {
          if (st.phase !== "leaving") return;
          st.phase = "settling";
          animateTo(0, () => cleanup(true));
        }, BACK_TIMEOUT_MS);
      });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (st.phase !== "idle") cleanup(true);
    };
  }, []);

  return null;
}
