"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setVisible(false);
      // Trigger reflow then show immediately
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }
  }, [pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: visible ? "opacity 0.15s ease-out" : "none",
      }}
    >
      {children}
    </div>
  );
}
