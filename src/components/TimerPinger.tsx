"use client";

import { useCallback, useEffect, useState } from "react";
import StudyCheckPopup, { type StudyCheck } from "@/components/StudyCheckPopup";

// 공부 타이머 전역 핑: 타이머 페이지가 아니어도(문제 풀기 등 앱 안 어디서든)
// 주기적으로 활성 세션의 lastPingAt을 갱신해 "마지막으로 앱을 쓴 시각"을 남긴다.
// 세션 유지 자체는 서버의 24h 스테일 컷오프가 담당하므로 핑 주기는 여유 있게 60초.
// 활성 세션이 없거나 미로그인이면 서버가 no-op/401이라 비용이 거의 없다.
//
// 핑 응답에 "공부 중 확인 퀴즈"가 실려 오면 팝업을 띄운다. 답을 안 하고 3시간이 지나면
// 서버가 타이머를 끈다(자리 비움 방지). 별도 폴링을 만들지 않으려고 핑에 얹었다.
export default function TimerPinger() {
  const [check, setCheck] = useState<StudyCheck | null>(null);

  const ping = useCallback(() => {
    fetch("/api/timer/ping", { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.check?.id) setCheck(d.check as StudyCheck);
        else if (!d?.session) setCheck(null); // 타이머가 꺼졌으면 팝업도 내린다
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
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
  }, [ping]);

  if (!check) return null;
  return (
    <StudyCheckPopup
      check={check}
      onDone={() => {
        setCheck(null);
        ping();
      }}
    />
  );
}
