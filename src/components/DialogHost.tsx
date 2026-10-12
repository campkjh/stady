"use client";

import { useEffect, useState } from "react";
import AlertModal from "@/components/AlertModal";
import { markEntranceReady } from "@/lib/entrance";
import { settleDialog, subscribeDialogs, uiAlert, type DialogRequest } from "@/lib/dialog";

/**
 * uiAlert / uiConfirm 이 요청한 다이얼로그를 그리는 호스트(루트 레이아웃에 한 번만 둔다).
 * 겹쳐 요청되면 먼저 온 것부터 차례로 보여 준다.
 * 네이티브 window.alert 도 같은 다이얼로그로 바꿔 끼운다 — 곳곳의 alert(...) 호출이 코드 수정 없이
 * 새 디자인으로 나온다(alert 는 값을 돌려주지 않아 비동기로 바뀌어도 안전).
 */
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => subscribeDialogs(setQueue), []);

  // 첫 하이드레이션이 끝났음을 알린다 — 이후 화면 이동부터 등장 연출 생략 규칙(lib/entrance)이 적용된다.
  useEffect(() => {
    markEntranceReady();
  }, []);

  useEffect(() => {
    const original = window.alert;
    window.alert = (message?: unknown) => {
      void uiAlert(String(message ?? ""));
    };
    return () => {
      window.alert = original;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const done = (ok: boolean) => settleDialog(current.id, ok);

  return (
    <AlertModal
      key={current.id}
      title={current.title}
      subtitle={current.body}
      onClose={() => done(false)}
      buttons={
        current.kind === "alert"
          ? [{ label: current.confirmLabel, onClick: () => done(true) }]
          : [
              {
                label: current.confirmLabel,
                bgColor: current.danger ? "var(--c-danger)" : undefined,
                onClick: () => done(true),
              },
              { label: current.cancelLabel, onClick: () => done(false) },
            ]
      }
    />
  );
}
