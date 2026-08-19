// 화면 테마(라이트/다크/시스템).
// - 저장: localStorage "stady-theme" = "light" | "dark" | "system" (없으면 light)
// 기본을 light 로 둔다: OS 가 다크인 사용자가 아무 설정 없이 갑자기 다크를 보는 일이 없게.
// 다크/시스템은 설정에서 직접 고른 사람만.
// - 적용: <html data-theme="light|dark"> — CSS 는 [data-theme="dark"] 로만 분기한다(globals.css 변수 블록).
// - 첫 페인트 전 세팅은 app/layout.tsx 의 인라인 스크립트(THEME_BOOT_SCRIPT)가 같은 규칙으로 처리한다.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "stady-theme";
export const THEME_CHANGE_EVENT = "stady-theme-change";

const DARK_MQ = "(prefers-color-scheme: dark)";

export function getTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) */
  }
  return "light";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_MQ).matches ? "dark" : "light";
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getTheme());
}

/** html[data-theme] 를 현재 설정대로 세팅. system 이면 matchMedia 로 결정하고 OS 변경을 계속 따라간다. */
export function applyTheme(pref: ThemePreference = getTheme()): ResolvedTheme {
  const resolved = resolveTheme(pref);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== resolved) root.setAttribute("data-theme", resolved);
  }
  watchSystem(pref === "system");
  return resolved;
}

let mq: MediaQueryList | null = null;
let mqHandler: ((e: MediaQueryListEvent) => void) | null = null;
function watchSystem(on: boolean) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  if (!mq) mq = window.matchMedia(DARK_MQ);
  if (on) {
    if (mqHandler) return;
    mqHandler = () => {
      if (getTheme() !== "system") return;
      const resolved = resolveTheme("system");
      document.documentElement.setAttribute("data-theme", resolved);
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { pref: "system", resolved } }));
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", mqHandler);
    else mq.addListener(mqHandler);
  } else if (mqHandler) {
    if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", mqHandler);
    else mq.removeListener(mqHandler);
    mqHandler = null;
  }
}

export function setTheme(pref: ThemePreference): ResolvedTheme {
  try {
    // 기본값이 light 이므로 system 도 명시 저장해야 다음 부팅에 살아남는다.
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  const resolved = applyTheme(pref);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { pref, resolved } }));
  return resolved;
}

/** layout.tsx <head> 에 넣는 첫 페인트 전 스크립트(깜빡임 방지). applyTheme 과 같은 규칙. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);var t=(v==="dark"||v==="light")?v:(v==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
