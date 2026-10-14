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
//
// 밀려나는 화면 뒤에는 '이전 화면'이 보여야 한다. SPA 라 이전 화면은 이미 사라졌으므로, 링크·버튼을 누르는 순간
// (React 핸들러보다 먼저 도는 click 캡처 단계) 화면(body)을 통째로 복제해 두었다가 제스처 때 밑에 깔아 준다.
//  · 복제본은 {경로, 노드, 스크롤} 로 스택에 쌓고, 그 경로로 돌아오면(뒤로) 꺼낸다.
//  · 복제본이 없으면(예: 코드로만 이동) 옅은 바탕으로 대신한다.

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

interface Snap {
  path: string;
  node: HTMLElement;
  scrollY: number;
}
const MAX_SNAPS = 3;
const PENDING_TTL_MS = 4000;

// 지금 화면의 복제본. 동작에 필요 없는 것(스크립트·미디어·개발용 오버레이)은 뺀다.
function snapshotPage(): Snap | null {
  try {
    const html = document.documentElement;
    if (html.classList.contains("swb-active") || document.body.style.position === "fixed") return null;
    const node = document.body.cloneNode(true) as HTMLElement;
    node
      .querySelectorAll("script,noscript,iframe,video,audio,canvas,nextjs-portal,next-route-announcer,.swb-ghost")
      .forEach((n) => n.remove());
    node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    node.removeAttribute("id");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("inert", "");
    return { path: window.location.pathname, node, scrollY: window.scrollY };
  } catch {
    return null;
  }
}

type Phase = "idle" | "track" | "drag" | "settling" | "leaving";

export default function EdgeSwipeBack() {
  const pathname = usePathname();
  const router = useRouter();
  const enabledRef = useRef(false);
  const leavingDoneRef = useRef<(() => void) | null>(null);
  const routerRef = useRef(router);
  const stackRef = useRef<Snap[]>([]);
  const pendingRef = useRef<{ snap: Snap; timer: number } | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // 경로가 바뀌면: 이 화면이 상세인지 갱신 + 이전 화면 복제본 스택 정리 + 뒤로 가는 중이었다면 마무리
  useEffect(() => {
    enabledRef.current = isDetailPath(pathname);
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev !== pathname) {
      const stack = stackRef.current;
      const pending = pendingRef.current;
      if (stack.length > 0 && stack[stack.length - 1].path === pathname) {
        stack.pop(); // 뒤로 돌아왔다 — 그 화면의 복제본은 이제 필요 없다
      } else if (pending && pending.snap.path === prev) {
        stack.push(pending.snap); // 앞으로 갔다 — 떠나온 화면을 복제본으로 남긴다
        if (stack.length > MAX_SNAPS) stack.shift();
      }
      if (pending) window.clearTimeout(pending.timer);
      pendingRef.current = null;
    }
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
      ghost: null as HTMLDivElement | null,
    };

    // 링크·버튼을 누르는 순간(React 핸들러보다 먼저) 지금 화면을 복제해 둔다. 이동하지 않는 클릭이면 곧 버린다.
    const onClickCapture = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest("input,textarea,select,label")) return;
      const snap = snapshotPage();
      if (!snap) return;
      const old = pendingRef.current;
      if (old) window.clearTimeout(old.timer);
      pendingRef.current = {
        snap,
        timer: window.setTimeout(() => {
          pendingRef.current = null;
        }, PENDING_TTL_MS),
      };
    };

    // 밀려나는 화면 밑에 깔 이전 화면(복제본). 없으면 null → 옅은 바탕만 보인다.
    const mountGhost = () => {
      const stack = stackRef.current;
      const snap = stack[stack.length - 1];
      if (!snap || snap.path === window.location.pathname) return;
      const ghost = document.createElement("div");
      ghost.className = "swb-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.appendChild(snap.node);
      html.appendChild(ghost);
      snap.node.scrollTop = snap.scrollY;
      st.ghost = ghost;
      setGhost(0);
    };
    const unmountGhost = () => {
      const g = st.ghost;
      if (!g) return;
      g.remove(); // 안의 복제본 노드는 메모리에 남아 다음 제스처에 다시 쓸 수 있다
      st.ghost = null;
    };
    // 진행도(0~1)에 따라 살짝 뒤에서 따라 나오고(시차) 어두움이 걷힌다
    const setGhost = (p: number) => {
      const g = st.ghost;
      if (!g) return;
      const x = -(1 - p) * st.w * 0.25;
      g.style.transform = `translate3d(${x}px, 0, 0)`;
      g.style.setProperty("--swb-dim", String(((1 - p) * 0.16).toFixed(3)));
    };

    const cleanup = (restoreScroll: boolean) => {
      window.clearTimeout(st.timer);
      html.classList.remove("swb-active");
      unmountGhost();
      body.style.transform = "";
      body.style.transition = "";
      if (restoreScroll) window.scrollTo(0, st.scrollY);
      st.phase = "idle";
      st.dx = 0;
      leavingDoneRef.current = null;
    };

    const animateTo = (x: number, done: () => void) => {
      const ease = `${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      body.style.transition = `transform ${ease}`;
      body.style.transform = `translate3d(${x}px, 0, 0)`;
      if (st.ghost) {
        st.ghost.style.transition = `transform ${ease}`;
        setGhost(x / st.w);
      }
      st.timer = window.setTimeout(done, ANIM_MS);
    };

    const begin = () => {
      st.scrollY = window.scrollY;
      st.w = window.innerWidth;
      html.classList.add("swb-active");
      body.scrollTop = st.scrollY; // body 가 스크롤 컨테이너가 됐으니 보던 자리를 그대로 옮긴다
      mountGhost();
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
      setGhost(Math.min(1, st.dx / st.w));
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
      // 돌아간 화면이 다시 페이드 인 하면 복제본과 어긋나 깜빡인다 — 진입 애니메이션을 잠깐 끈다
      html.classList.add("swb-noenter");
      window.setTimeout(() => html.classList.remove("swb-noenter"), 900);
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

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (st.phase !== "idle") cleanup(true);
    };
  }, []);

  return null;
}
