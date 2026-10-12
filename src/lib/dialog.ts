/**
 * 앱 전역 알럿·컨펌 — 네이티브 alert/confirm 대신 쓴다(DialogHost 가 화면에 그린다).
 *  · uiAlert(message)  : 확인 버튼 하나(Alert 시안). await 하면 닫힐 때까지 기다린다.
 *  · uiConfirm(message): 취소/확인 두 버튼(Confirm 시안). 확인 = true, 취소·바깥 탭·ESC = false.
 * 안드로이드 WebView 는 window.confirm 이 동작하지 않아 이 경로가 필수다(예전 책갈피 전체 취소 사고).
 */

export interface DialogRequest {
  id: number;
  kind: "alert" | "confirm";
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

export interface DialogOptions {
  /** 제목을 따로 주면 message 는 전부 설명으로 쓴다 */
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제처럼 되돌릴 수 없는 동작이면 확인 버튼을 빨강으로 */
  danger?: boolean;
}

type Listener = (queue: DialogRequest[]) => void;

let seq = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(queue));
}

export function subscribeDialogs(l: Listener) {
  listeners.add(l);
  l(queue);
  return () => {
    listeners.delete(l);
  };
}

export function settleDialog(id: number, ok: boolean) {
  const req = queue.find((q) => q.id === id);
  if (!req) return;
  queue = queue.filter((q) => q.id !== id);
  emit();
  req.resolve(ok);
}

/**
 * 한 줄 문장을 제목+설명으로 나눈다.
 *  · 줄바꿈이 있으면 첫 줄 = 제목, 나머지 = 설명
 *  · 한 줄이 길면 첫 문장 = 제목, 나머지 = 설명
 *  · 문장이 하나뿐이고 길면 기본 제목("알림"/"확인해 주세요") + 본문
 */
export function splitMessage(message: string, kind: "alert" | "confirm"): { title: string; body: string } {
  const text = String(message ?? "").trim();
  const nl = text.indexOf("\n");
  if (nl > -1) return { title: text.slice(0, nl).trim(), body: text.slice(nl + 1).trim() };
  if (text.length <= 22) return { title: text, body: "" };
  const m = text.match(/^(.+?[.?!。])\s+(.+)$/);
  if (m) return { title: m[1], body: m[2] };
  return { title: kind === "alert" ? "알림" : "확인해 주세요", body: text };
}

function push(kind: "alert" | "confirm", message: string, opts: DialogOptions = {}): Promise<boolean> {
  const split = opts.title ? { title: opts.title, body: String(message ?? "") } : splitMessage(message, kind);
  return new Promise<boolean>((resolve) => {
    queue = [
      ...queue,
      {
        id: ++seq,
        kind,
        title: split.title,
        body: split.body,
        confirmLabel: opts.confirmLabel ?? "확인",
        cancelLabel: opts.cancelLabel ?? "취소",
        danger: !!opts.danger,
        resolve,
      },
    ];
    emit();
  });
}

export async function uiAlert(message: string, opts?: DialogOptions): Promise<void> {
  await push("alert", message, opts);
}

export function uiConfirm(message: string, opts?: DialogOptions): Promise<boolean> {
  return push("confirm", message, opts);
}
