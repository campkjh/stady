"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// 탭을 옮길 때마다 진입 인터랙션을 한 번 재생한다(스타일은 globals.css 의 .page-enter).
// 클래스를 DOM 에서 직접 뗐다 붙여 애니메이션을 재시작한다 —
//  · key 를 바꾸면 화면이 통째로 리마운트돼 데이터까지 다시 불러온다.
//  · setState 로 토글하면 React Compiler 가 막고(이펙트 내 동기 setState),
//    리플로우 타이밍도 보장되지 않는다.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-enter");
    void el.offsetWidth; // 강제 리플로우 — 이게 있어야 애니메이션이 처음부터 다시 돈다
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
