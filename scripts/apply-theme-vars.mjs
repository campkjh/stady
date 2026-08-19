#!/usr/bin/env node
// 다크모드 팔레트 치환 스크립트 (idempotent, --dry 지원)
//
//   node apply-theme-vars.mjs [--dry] [--root /path/to/stady] [--verbose]
//
// 하는 일
//  1) src/**/*.tsx (app/api 제외) + src/app/globals.css 의 색 리터럴(#hex / rgba(255,255,255,a) / white)을
//     **속성 문맥**(같은 style 객체·CSS 규칙·JSX 속성의 직전 속성명)을 보고 var(--c-xxx) 로 치환한다.
//       - background/backgroundColor/border*/boxShadow/outline/bg:  → SURFACE(면·경계) 표
//       - color/fill/stroke/caretColor/WebkitTextFillColor/text:/tint: → TEXT(글자·아이콘) 표
//       - 브랜드·상태색(ACCENT)은 속성 무관 동일 변수
//       - color/fill/stroke 의 #fff/white 는 치환 안 함(파란 버튼·딤 위 흰 글자)
//       - gradient(...) 안, 캔버스(strokeStyle/fillStyle), 그림자 rgba, 알 수 없는 문맥은 그대로 둔다
//  2) globals.css 의 마커 블록 안에 :root(라이트 원색) / [data-theme="dark"](다크) 변수 정의를 생성한다.
//     라이트 값은 치환 전 원색과 동일하므로 라이트 렌더링은 바뀌지 않는다(폴백 없음 → 이중관리 없음).
//
// 두 번 돌려도 결과가 같다(이미 var(...) 인 곳엔 색 리터럴이 없고, 변수 블록은 매번 재생성).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SURFACE, TEXT, ACCENT, RGBA_SURFACE, CONST_HINTS } from "./dark-palette.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const VERBOSE = args.includes("--verbose");
const rootIdx = args.indexOf("--root");
const ROOT = rootIdx >= 0 ? args[rootIdx + 1] : "/Users/jeonghunjeonghun-a.../stady";
const SRC = path.join(ROOT, "src");
const GLOBALS = path.join(SRC, "app", "globals.css");

const BLOCK_START = "/* ==== theme vars: scratchpad/apply-theme-vars.mjs 가 생성 — 손으로 고치지 말 것 ==== */";
const BLOCK_END = "/* ==== /theme vars ==== */";

// ── 표 준비 ──
const norm = (h) => {
  h = h.toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(h)) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
};
const byLight = (list) => { const m = new Map(); for (const e of list) { if (m.has(e.light)) throw new Error("dup light " + e.light); m.set(e.light, e); } return m; };
const SURF = byLight(SURFACE), TXT = byLight(TEXT), ACC = byLight(ACCENT);
const allNames = new Set();
for (const e of [...SURFACE, ...TEXT, ...ACCENT]) { if (allNames.has(e.name)) throw new Error("dup name " + e.name); allNames.add(e.name); }
// 같은 hex 가 두 표에 있으면 안 되는 조합(ACCENT 는 속성 무관이라 다른 표와 겹치면 안 됨)
for (const e of ACCENT) if (SURF.has(e.light) || TXT.has(e.light)) throw new Error("ACCENT overlaps " + e.light);

// ── 속성 → 카테고리 ──
const S_PROPS = ["background", "backgroundColor", "background-color", "border", "borderColor", "border-color",
  "borderTop", "borderBottom", "borderLeft", "borderRight", "border-top", "border-bottom", "border-left", "border-right",
  "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "border-top-color", "border-bottom-color",
  "border-left-color", "border-right-color", "borderInline", "borderBlock", "outline", "outlineColor", "outline-color",
  "boxShadow", "box-shadow", "WebkitBoxShadow", "-webkit-box-shadow", "bg", "bgColor", "backgroundColorHover"];
const T_PROPS = ["color", "fill", "stroke", "WebkitTextFillColor", "-webkit-text-fill-color", "caretColor", "caret-color",
  "accentColor", "accent-color", "textDecorationColor", "text", "tint", "fg", "textColor"];
const SKIP_PROPS = ["strokeStyle", "fillStyle", "shadowColor", "filter", "backdropFilter", "backdrop-filter", "textShadow", "text-shadow",
  "mask", "WebkitMask", "-webkit-mask", "maskImage", "content", "stopColor", "stop-color", "floodColor", "flood-color",
  "-webkit-tap-highlight-color", "WebkitTapHighlightColor", "theme-color", "color-scheme", "scrollbarColor", "scrollbar-color",
  "backgroundImage", "background-image", "textDecoration", "text-decoration", "borderImage", "border-image", "src", "href", "d", "id", "key", "name", "value", "label", "title", "alt", "placeholder"];
const PROP_CAT = new Map();
for (const p of S_PROPS) PROP_CAT.set(p, "S");
for (const p of T_PROPS) PROP_CAT.set(p, "T");
for (const p of SKIP_PROPS) PROP_CAT.set(p, "X");
for (const [n, c] of Object.entries(CONST_HINTS)) PROP_CAT.set(n, c === "surface" ? "S" : c === "text" ? "T" : "A");

const PROP_RE = /([A-Za-z_-][A-Za-z0-9_-]*)\s*(?::(?!:)|=(?!=))/g;
function lastKnownProp(text) {
  let found = null;
  for (const m of text.matchAll(PROP_RE)) if (PROP_CAT.has(m[1])) found = m[1];
  return found;
}
function inUnclosedGradient(text) {
  const i = text.lastIndexOf("gradient(");
  if (i < 0) return false;
  let depth = 0;
  for (let k = i + 8; k < text.length; k++) { const c = text[k]; if (c === "(") depth++; else if (c === ")") { depth--; if (depth === 0) return false; } }
  return true;
}
// 토큰 위치의 속성 문맥. 같은 줄 → 없으면 위로 최대 8줄(값이 여러 줄에 걸친 경우).
function propContext(lines, li, col) {
  const before = lines[li].slice(0, col);
  let prop = lastKnownProp(before);
  let ctx = before;
  let carried = false;
  if (!prop) {
    for (let up = 1; up <= 8 && li - up >= 0; up++) {
      const pl = lines[li - up];
      const t = pl.trim();
      const p = lastKnownProp(pl);
      if (p) {
        // 값이 이어지는 형태인가: `prop:` / `? "a"` / `cond` / `(` / 백틱 로 끝남 (콤마·세미콜론·중괄호로 끝나면 완결된 값)
        const continues = /[?:(\[`=]\s*$/.test(t) || /=>\s*$/.test(t) || (!/[,;{}>]\s*$/.test(t) && !/^\/\//.test(t));
        if (continues) { prop = p; carried = true; ctx = lines.slice(li - up, li).join("\n") + "\n" + before; }
        break;
      }
      // 속성이 없는 줄: 문(statement)이 끝났으면 중단
      if (/[;{}]\s*$/.test(t) && !/[?]\s*$/.test(t)) break;
    }
  }
  return { prop, carried, inGradient: inUnclosedGradient(ctx) };
}

// ── 치환 ──
const TOKEN_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba\([^)]*\)|(?<![\w-])white(?![\w-])/g;
const usedVars = new Map();       // name → count
const rgbaVars = new Map();       // name → {light, dark}
const leftovers = new Map();      // `${cat}|${prop}|${token}` → count
const perFile = [];

function lookup(cat, prop, hex) {
  if (cat === "S") return SURF.get(hex) || ACC.get(hex) || TXT.get(hex) || null;
  if (cat === "T") {
    if (prop === "color") return TXT.get(hex) || ACC.get(hex) || null;
    return TXT.get(hex) || ACC.get(hex) || SURF.get(hex) || null;
  }
  if (cat === "A") return ACC.get(hex) || SURF.get(hex) || TXT.get(hex) || null;
  return null;
}

function transform(src, file, opts = {}) {
  const lines = src.split("\n");
  const skipRanges = opts.skipRanges || [];
  let out = "";
  let count = 0;
  const details = [];
  let offset = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineStart = offset;
    offset += line.length + 1;
    if (skipRanges.some(([a, b]) => li >= a && li <= b)) { out += line + "\n"; continue; }
    let rebuilt = "";
    let last = 0;
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(line))) {
      const tok = m[0];
      const col = m.index;
      if (/^#[0-9a-fA-F]{8}$/.test(tok)) continue;             // 8자리(알파) hex 는 건드리지 않음
      if (col > 0 && line[col - 1] === "[") continue;         // Tailwind arbitrary 값(border-[#E5E7EB]) — CSS 클래스 오버라이드로 처리
      // 이미 var(...) 안이거나 주석/문자열 밖 판단은 하지 않는다(문맥 속성으로 충분)
      const { prop, carried, inGradient } = propContext(lines, li, col);
      const cat = prop ? PROP_CAT.get(prop) : null;
      let rep = null;
      let reason = "";
      if (!cat || cat === "X") { reason = cat === "X" ? "skip-prop" : "no-prop"; }
      else if (inGradient) { reason = "gradient"; }
      else if (tok === "white" || /^#(fff|ffffff)$/i.test(tok)) {
        // 같은 줄에 옅은 흰 오버레이(rgba(255,255,255,<.5))가 있으면 파란/딤 크롬 위의 흰 링(스피너 등) → 유지
        if (cat === "S" && !/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.[0-4]/.test(line)) { rep = "var(--c-bg)"; }
        else reason = "white-text-keep";
      } else if (tok.startsWith("rgba(")) {
        if (cat === "S") {
          for (const r of RGBA_SURFACE) {
            r.light.lastIndex = 0;
            const mm = r.light.exec(tok);
            if (mm && mm[0] === tok) {
              const a = Number(mm[1]);
              if (a >= r.minAlpha) {
                const nm = `${r.name}${Math.round(a * 100)}`;
                rep = `var(--c-${nm})`;
                rgbaVars.set(nm, { light: tok.replace(/\s+/g, ""), dark: r.dark(mm[1]) });
              }
              break;
            }
          }
          if (!rep) reason = "rgba-keep";
        } else reason = "rgba-keep";
      } else {
        const hex = norm(tok);
        const e = lookup(cat, prop, hex);
        if (e) rep = `var(--c-${e.name})`; else reason = "unmapped";
      }
      if (rep) {
        rebuilt += line.slice(last, col) + rep;
        last = col + tok.length;
        count++;
        const nm = rep.slice(8, -1);
        usedVars.set(nm, (usedVars.get(nm) || 0) + 1);
        if (VERBOSE) details.push(`  ${li + 1}: ${carried ? "^" : ""}${prop} ${tok} → ${rep} :: ${line.trim().slice(0, 120)}`);
      } else {
        const k = `${reason}|${prop || "-"}|${tok.startsWith("#") ? norm(tok) : tok}`;
        leftovers.set(k, (leftovers.get(k) || 0) + 1);
        if (VERBOSE && reason !== "white-text-keep") details.push(`  ${li + 1}: LEFT(${reason}) ${prop} ${tok} :: ${line.trim().slice(0, 140)}`);
      }
    }
    rebuilt += line.slice(last);
    out += rebuilt + (li < lines.length - 1 ? "\n" : "");
  }
  return { out, count, details };
}

// ── 파일 수집 ──
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p === path.join(SRC, "app", "api")) continue; walk(p, acc); }
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}
const files = walk(SRC, []).sort();

let totalRep = 0, changedFiles = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const { out, count, details } = transform(src, f);
  if (out !== src) {
    changedFiles++; totalRep += count;
    perFile.push([path.relative(ROOT, f), count]);
    if (VERBOSE) console.log(path.relative(ROOT, f) + "\n" + details.join("\n"));
    if (!DRY) fs.writeFileSync(f, out);
  }
}

// ── globals.css: 본문 치환(마커 블록 제외) + 변수 블록 생성 ──
{
  let css = fs.readFileSync(GLOBALS, "utf8");
  // 기존 블록 제거
  const si = css.indexOf(BLOCK_START), ei = css.indexOf(BLOCK_END);
  if (si >= 0 && ei > si) css = css.slice(0, si) + css.slice(ei + BLOCK_END.length).replace(/^\n/, "");
  const { out, count } = transform(css, GLOBALS);
  css = out;
  if (count) { totalRep += count; perFile.push(["src/app/globals.css", count]); }

  // rgba 변수: 소스에 이미 들어간 var(--c-bg-aNN) 도 정의 유지(재실행 idempotent)
  const scanVarUse = (text) => {
    for (const m of text.matchAll(/var\(--c-(bg-a|tint-a)(\d+)\)/g)) {
      const nm = m[1] + m[2];
      if (!rgbaVars.has(nm)) {
        const a = Number(m[2]) / 100;
        const r = RGBA_SURFACE.find((x) => x.name === m[1]);
        const aStr = a === 1 ? "1" : String(a).replace(/^0/, "0");
        rgbaVars.set(nm, { light: m[1] === "bg-a" ? `rgba(255,255,255,${aStr})` : `rgba(7,25,76,${aStr})`, dark: r.dark(aStr) });
      }
    }
  };
  for (const f of files) scanVarUse(fs.readFileSync(f, "utf8"));
  scanVarUse(css);

  // 실제 사용되는 변수만 정의(치환 후 소스 전수 스캔 → 재실행에도 동일). 표에 없는 이름이 쓰이면 실패.
  const usedNames = new Set();
  const scanNames = (text) => { for (const m of text.matchAll(/var\(--c-([a-z0-9-]+)\)/g)) usedNames.add(m[1]); };
  for (const f of files) scanNames(DRY ? transform(fs.readFileSync(f, "utf8"), f).out : fs.readFileSync(f, "utf8"));
  scanNames(css);
  const known = new Set([...allNames, ...rgbaVars.keys()]);
  for (const n of usedNames) if (!known.has(n)) throw new Error("정의 없는 변수 사용: --c-" + n);
  const lightLines = [], darkLines = [];
  const emit = (title, list) => {
    const use = list.filter((e) => usedNames.has(e.name));
    if (!use.length) return;
    lightLines.push(`  /* ${title} */`); darkLines.push(`  /* ${title} */`);
    for (const e of use) { lightLines.push(`  --c-${e.name}: ${e.light};`); darkLines.push(`  --c-${e.name}: ${e.dark};`); }
  };
  emit("면·경계", SURFACE); emit("글자·아이콘", TEXT); emit("브랜드·상태", ACCENT);
  const rg = [...rgbaVars.entries()].filter(([n]) => usedNames.has(n)).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  if (rg.length) { lightLines.push("  /* 반투명 면 */"); darkLines.push("  /* 반투명 면 */"); for (const [n, v] of rg) { lightLines.push(`  --c-${n}: ${v.light};`); darkLines.push(`  --c-${n}: ${v.dark};`); } }
  const block = [
    BLOCK_START,
    `/* 라이트 값 = 치환 전 원색 그대로(라이트 렌더링 불변). 다크 값은 scratchpad/dark-palette.mjs 에서 관리. */`,
    `:root {`, ...lightLines, `}`,
    `[data-theme="dark"] {`, ...darkLines, `}`,
    BLOCK_END,
  ].join("\n");
  // 삽입 위치: @theme inline { ... } 블록 뒤
  const themeEnd = (() => { const i = css.indexOf("@theme inline"); if (i < 0) return -1; const j = css.indexOf("\n}", i); return j < 0 ? -1 : j + 2; })();
  if (themeEnd < 0) throw new Error("globals.css: @theme inline 블록을 못 찾음");
  css = css.slice(0, themeEnd) + "\n" + block + "\n" + css.slice(themeEnd).replace(/^\n/, "");
  const before = fs.readFileSync(GLOBALS, "utf8");
  if (css !== before) { changedFiles++; if (!DRY) fs.writeFileSync(GLOBALS, css); }
}

// ── 리포트 ──
console.log(`${DRY ? "[dry-run] " : ""}files changed: ${changedFiles}, replacements: ${totalRep}`);
if (perFile.length) console.log(perFile.map(([f, c]) => `  ${c}\t${f}`).join("\n"));
console.log("\nvars used (top 40):");
console.log([...usedVars.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, c]) => `  ${c}\t--c-${n}`).join("\n"));
const lf = [...leftovers.entries()].sort((a, b) => b[1] - a[1]);
const grp = {};
for (const [k, c] of lf) { const r = k.split("|")[0]; grp[r] = (grp[r] || 0) + c; }
console.log("\nleft as-is by reason:", JSON.stringify(grp));
console.log("unmapped / no-prop (top 60):");
console.log(lf.filter(([k]) => /^(unmapped|no-prop)\|/.test(k)).slice(0, 60).map(([k, c]) => `  ${c}\t${k}`).join("\n"));
