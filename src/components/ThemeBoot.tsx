"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

// 마운트 시 테마를 한 번 더 적용하고, '시스템' 설정이면 OS 다크모드 변경을 계속 따라가게 리스너를 건다.
// (첫 페인트는 layout.tsx 의 인라인 스크립트가 처리하므로 여기선 깜빡임이 없다.)
export default function ThemeBoot() {
  useEffect(() => {
    applyTheme();
  }, []);
  return null;
}
