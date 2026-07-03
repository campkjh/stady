"use client";

import { useEffect } from "react";

// 공부 타이머 전역 핑: 타이머 페이지가 아니어도(문제 풀기 등 앱 안 어디서든)
// 주기적으로 활성 세션의 lastPingAt을 갱신해 "마지막으로 앱을 쓴 시각"을 남긴다.
// 세션 유지 자체는 서버의 24h 스테일 컷오프가 담당하므로 핑 주기는 여유 있게 60초.
// 활성 세션이 없거나 미로그인이면 서버가 no-op/401이라 비용이 거의 없다.
export default function TimerPinger() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/timer/ping", { method: "POST" }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
