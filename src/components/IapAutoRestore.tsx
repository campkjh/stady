"use client";

import { useEffect } from "react";
import { autoRestoreEntitlement } from "@/lib/iap/client";

// 앱 실행 시 1회, 조용히 구매 복원을 시도한다(이용권 없는데 스토어엔 구독이 있으면 지급).
// 렌더 없음. 네이티브 앱 + 로그인 + 미보유일 때만 실제로 동작(내부에서 판별).
export default function IapAutoRestore() {
  useEffect(() => {
    void autoRestoreEntitlement();
  }, []);
  return null;
}
