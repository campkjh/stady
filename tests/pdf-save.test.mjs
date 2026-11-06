import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const source = stripTypeScriptTypes(await readFile(new URL("../src/lib/pdfSave.ts", import.meta.url), "utf8"));
const pdf = Buffer.from("%PDF-1.4\n% download regression fixture\n%%EOF\n");

async function listen(server) {
  await new Promise(resolve => server.listen(0, resolve));
  return server.address().port;
}

test("premium PDF redirect keeps app cookies without credentialed Blob CORS", async () => {
  const storeCookies = [];
  const appCookies = [];
  const store = createServer((req, res) => {
    storeCookies.push(req.headers.cookie || "");
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=fixture.pdf",
    });
    res.end(pdf);
  });
  const storePort = await listen(store);
  const app = createServer((req, res) => {
    if (req.url === "/pdfSave.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return res.end(source);
    }
    if (req.url?.startsWith("/api/csat-prep/pdf")) {
      appCookies.push(req.headers.cookie || "");
      if (!req.headers.cookie?.includes("premium=test-session")) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Premium required" }));
      }
      res.writeHead(302, { Location: `http://localhost:${storePort}/fixture.pdf?download=1` });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>PDF download test</title>");
  });
  const appPort = await listen(app);
  const origin = `http://127.0.0.1:${appPort}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
    const context = await browser.newContext();
    await context.addCookies([{ name: "premium", value: "test-session", url: origin, httpOnly: true }]);
    const page = await context.newPage();
    await page.goto(origin);

    // Reproduce the original browser-only failure (a Node fetch cannot check CORS).
    assert.equal(await page.evaluate(async () => {
      try { await fetch("/api/csat-prep/pdf?key=elite", { credentials: "include" }); return false; }
      catch { return true; }
    }), true);

    for (const key of ["elite", "csat-final", "csat-ethics-thought"]) {
      for (const kind of key === "elite" ? ["problem"] : ["problem", "solution"]) {
        const result = await page.evaluate(async ({ key, kind }) => {
          const { fetchPdfFile } = await import("/pdfSave.js");
          const file = await fetchPdfFile(`/api/csat-prep/pdf?key=${key}&kind=${kind}`, `${key}-${kind}.pdf`);
          return { name: file.name, type: file.type, text: await file.text() };
        }, { key, kind });
        assert.equal(result.name, `${key}-${kind}.pdf`);
        assert.equal(result.type, "application/pdf");
        assert.equal(result.text, pdf.toString());
      }
    }

    const downloaded = page.waitForEvent("download");
    await page.evaluate(async () => {
      const { fetchPdfFile, downloadFiles } = await import("/pdfSave.js");
      downloadFiles([await fetchPdfFile("/api/csat-prep/pdf?key=elite", "elite.pdf")]);
    });
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), "elite.pdf");
    assert.deepEqual(await readFile(await download.path()), pdf);
    assert.ok(appCookies.every(cookie => cookie.includes("premium=test-session")));
    assert.ok(storeCookies.every(cookie => cookie === ""));

    await context.clearCookies();
    assert.equal(await page.evaluate(async () => {
      const { fetchPdfFile } = await import("/pdfSave.js");
      try { await fetchPdfFile("/api/csat-prep/pdf?key=elite", "elite.pdf"); return "unexpected success"; }
      catch (error) { return error.message; }
    }), "Premium required");
  } finally {
    await browser?.close();
    await new Promise(resolve => app.close(resolve));
    await new Promise(resolve => store.close(resolve));
  }
});
