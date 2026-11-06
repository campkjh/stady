import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// Optional browser tools can be supplied without changing the app's dependencies.
// ESBUILD_MODULE=/path/to/esbuild PLAYWRIGHT_MODULE=/path/to/playwright node --test tests/mock-exam-viewer.browser.test.mjs
let esbuild, chromium;
try {
  esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"));
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

test("tablet exam images are bounded, annotations survive release, and failed images recover", {
  skip: !esbuild || !chromium ? "Requires optional esbuild and playwright browser tools" : false,
  timeout: 60000,
}, async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const exam = {
    id: "tablet-regression", title: "Tablet exam", subtitle: null,
    imageUrls: Array.from({ length: 16 }, (_, i) => `/fixtures/problem-${i}.svg`),
    solutionImageUrls: Array.from({ length: 5 }, (_, i) => `/fixtures/solution-${i}.svg`),
    lineBoxes: [], solutionLineBoxes: [],
  };
  const bundle = await esbuild.build({
    absWorkingDir: root, bundle: true, write: false, jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import Viewer from './src/components/MockExamViewer';
        createRoot(document.getElementById('root')).render(<React.StrictMode><Viewer exam={${JSON.stringify(exam)}} /></React.StrictMode>);`,
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
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1104" height="1560"><rect width="1104" height="1560" fill="white"/><text x="60" y="100" font-size="30">Exam page</text></svg>');
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
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const ready = () => page.waitForFunction(() => document.querySelector('img[alt="페이지 1"]')?.naturalWidth > 0);
    const imageCount = () => page.locator('img[alt^="페이지 "]').count();
    const scroll = page.locator(".mock-viewer-root > div").last();
    await ready();
    assert.ok(await imageCount() <= 3, "offscreen images must not mount on entry");
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const r = canvas.getBoundingClientRect();
      for (const [type, x] of [["pointerdown", 100], ["pointermove", 180], ["pointerup", 180]]) {
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "pen", clientX: r.left + x, clientY: r.top + 120, pressure: 0.5 }));
      }
    });
    await page.waitForTimeout(1100);
    const annotation = await page.evaluate(() => document.querySelector("canvas").toDataURL());
    assert.ok(annotation.length > 1000);
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForFunction(() => document.querySelector('img[alt="페이지 16"]')?.naturalWidth > 0);
    assert.ok(await imageCount() <= 3, "old images must be released after scrolling");
    assert.equal(await page.evaluate(() => document.querySelector("canvas").width), 0);
    await scroll.evaluate(el => { el.scrollTop = 0; });
    await ready();
    await page.waitForFunction(value => document.querySelector("canvas").toDataURL() === value, annotation);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "문제/해설 전환" }).click();
      await page.getByRole("button", { name: "해설보기", exact: true }).click();
      await ready();
      assert.ok(await imageCount() <= 3);
      await page.getByRole("button", { name: "문제/해설 전환" }).click();
      await page.getByRole("button", { name: "문제", exact: true }).click();
      await ready();
      await page.waitForFunction(value => document.querySelector("canvas").toDataURL() === value, annotation);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    assert.ok(await imageCount() <= 3);
    await scroll.evaluate(el => {
      const touches = xs => xs.map((x, i) => new Touch({ identifier: i, target: el, clientX: x, clientY: 300 }));
      el.dispatchEvent(new TouchEvent("touchstart", { touches: touches([100, 200]) }));
      el.dispatchEvent(new TouchEvent("touchmove", { touches: touches([100, 300]), cancelable: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [] }));
    });
    await page.waitForFunction(() => document.querySelector('[style*="scale(2)"]'));
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForFunction(() => document.querySelector('img[alt="페이지 16"]')?.naturalWidth > 0);
    assert.ok(await imageCount() <= 3, "zoomed viewport bounds must release distant pages");
    let fail = true;
    await page.route("**/fixtures/problem-0.svg*", route => fail ? route.abort() : route.continue());
    await page.reload();
    await page.getByRole("button", { name: "다시 불러오기" }).waitFor();
    const retryBounds = await page.getByRole("button", { name: "다시 불러오기" }).boundingBox();
    assert.ok(retryBounds.y + retryBounds.height < 800, "retry must be visible in landscape without scrolling");
    fail = false;
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await ready();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
