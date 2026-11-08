import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// 아이패드 신고(261108): 필기를 쓰고 위로 올라갔다 오거나 화면을 나갔다 오면 필기가 사라짐.
// localStorage 가 꽉 찬 기기에서 setItem 이 조용히 실패하던 것 — 꽉 찬 상태를 만들어 재현한다.
// ESBUILD_MODULE=/path/to/esbuild PLAYWRIGHT_MODULE=/path/to/playwright node --test tests/mock-exam-ink-store.browser.test.mjs
let esbuild, chromium;
try {
  esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"));
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

test("annotations survive a full localStorage, page release, remount and reload", {
  skip: !esbuild || !chromium ? "Requires optional esbuild and playwright browser tools" : false,
  timeout: 60000,
}, async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const exam = {
    id: "ink-store", title: "Ink exam", subtitle: null,
    imageUrls: Array.from({ length: 6 }, (_, i) => `/fixtures/problem-${i}.svg`),
    solutionImageUrls: [], lineBoxes: [], solutionLineBoxes: [],
  };
  const bundle = await esbuild.build({
    absWorkingDir: root, bundle: true, write: false, jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import Viewer from './src/components/MockExamViewer';
        const r = createRoot(document.getElementById('root'));
        const show = () => r.render(<Viewer exam={${JSON.stringify(exam)}} />);
        window.__unmount = () => r.render(<div />);
        window.__mount = show;
        show();`,
      loader: "tsx", resolveDir: root,
    },
    plugins: [{ name: "mock-navigation", setup(build) {
      build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const useRouter=()=>({back(){},push(){}});" }));
    } }],
  });
  const server = http.createServer((req, res) => {
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(bundle.outputFiles[0].contents);
    }
    if (req.url.startsWith("/fixtures/")) {
      res.setHeader("Content-Type", "image/svg+xml");
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1104" height="1560"><rect width="1104" height="1560" fill="white"/></svg>');
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;--c-bg:#fff;--c-inverse-6:#111}</style><div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    // 옛 버전이 남긴 필기 1장(2쪽) + 저장공간을 꽉 채우는 쓰레기.
    await page.goto(`${origin}/blank`);
    const legacy = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 280;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "red"; ctx.fillRect(20, 20, 60, 60);
      const url = c.toDataURL("image/png");
      localStorage.setItem("mockexam_ink-store_p1", url);
      // 큰 덩어리부터 1글자까지 줄여 가며 남는 틈 없이 채운다.
      let n = 0;
      for (let size = 256 * 1024; size >= 1; size = Math.floor(size / 2)) {
        const chunk = "x".repeat(size);
        for (;;) {
          try { localStorage.setItem(`f${n++}`, chunk); } catch { break; }
        }
      }
      // 꽉 찼는지 확인.
      try { localStorage.setItem("probe", "xx"); return "not-full"; } catch { return url.length; }
    });
    assert.notEqual(legacy, "not-full");

    await page.goto(origin);
    const scroll = page.locator(".mock-viewer-root > div").last();
    const ready = () => page.waitForFunction(() => document.querySelector('img[alt="페이지 1"]')?.naturalWidth > 0);
    const ink = () => page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c.width) return 0;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    await ready();
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const r = canvas.getBoundingClientRect();
      for (const [type, x] of [["pointerdown", 100], ["pointermove", 300], ["pointerup", 300]]) {
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "pen", clientX: r.left + x, clientY: r.top + 120, pressure: 0.5 }));
      }
    });
    const drawn = await ink();
    assert.ok(drawn > 100, "stroke must be drawn");

    // 저장 타이머(900ms)가 돌기 전에 바로 멀리 스크롤 → 반납 → 돌아오기.
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForFunction(() => document.querySelector("canvas").width === 0);
    await scroll.evaluate(el => { el.scrollTop = 0; });
    await ready();
    await page.waitForFunction(() => document.querySelector("canvas").width > 0);
    await page.waitForTimeout(300);
    assert.ok(await ink() > drawn * 0.8, "annotation must survive release with a full localStorage");

    // 화면을 나갔다 들어오기(같은 앱 안).
    await page.evaluate(() => window.__unmount());
    await page.evaluate(() => window.__mount());
    await ready();
    await page.waitForFunction(() => document.querySelector("canvas").width > 0);
    await page.waitForTimeout(300);
    assert.ok(await ink() > drawn * 0.8, "annotation must survive leaving the viewer");

    // 앱을 껐다 켜기(새로고침) → IndexedDB 에서 복원, 옛 localStorage 필기도 옮겨져 있어야 한다.
    await page.waitForTimeout(500);
    await page.reload();
    await ready();
    await page.waitForFunction(() => document.querySelector("canvas").width > 0);
    await page.waitForTimeout(300);
    assert.ok(await ink() > drawn * 0.8, "annotation must survive a reload");
    await page.waitForFunction(() => localStorage.getItem("mockexam_ink-store_p1") === null);
    const migrated = await page.evaluate(() => new Promise(resolve => {
      const req = indexedDB.open("stady-ink");
      req.onsuccess = () => {
        const get = req.result.transaction("ink").objectStore("ink").get("mockexam_ink-store_p1");
        get.onsuccess = () => resolve(typeof get.result === "string" ? get.result.length : 0);
      };
    }));
    assert.equal(migrated, legacy, "legacy localStorage annotation must move to IndexedDB");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
