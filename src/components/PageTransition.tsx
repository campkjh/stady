"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitioning(false);
        prevPathname.current = pathname;
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? "translateY(8px)" : "translateY(0)",
        transition: "opacity 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      {displayChildren}
    </div>
  );
}
