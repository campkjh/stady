import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const source = stripTypeScriptTypes(process.env.IAP_TEST_REF
  ? execFileSync("git", ["show", `${process.env.IAP_TEST_REF}:src/lib/iap/client.ts`], { encoding: "utf8" })
  : await readFile(new URL("../src/lib/iap/client.ts", import.meta.url), "utf8"));
const flush = () => new Promise(resolve => setImmediate(resolve));

async function fixture({ platform = "google", restoreSupported = true, dispatchThrows = false } = {}) {
  const calls = [], verifications = [], timers = new Map(), states = [], refs = [];
  let stateIndex = 0, refIndex = 0, timerId = 0;
  const bridge = {
    iapPurchase() {
      calls.push("purchase");
      if (dispatchThrows) throw new Error("Bridge unavailable");
    },
    ...(restoreSupported ? { iapRestore() { calls.push("restore"); } } : {}),
  };
  const window = platform === "google" ? { Android: bridge } : {
    webkit: { messageHandlers: {
      iapPurchase: { postMessage: () => bridge.iapPurchase() },
      iapRestore: { postMessage: () => bridge.iapRestore() },
    } },
  };
  const context = vm.createContext({
    window, console, Response,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => {
      if (url === "/api/iap/status") return Response.json({
        authenticated: true, entitlement: { active: false },
        plans: [{ id: "monthly", productIds: { google: "monthly", apple: "apple.monthly" } }],
      });
      verifications.push({ url, payload: JSON.parse(options.body) });
      return Response.json({ ok: true, entitlement: { active: true } });
    },
  });
  const react = new vm.SyntheticModule(["useCallback", "useEffect", "useRef", "useState"], function () {
    this.setExport("useCallback", fn => fn);
    this.setExport("useEffect", () => {});
    this.setExport("useRef", value => refs[refIndex++] ??= { current: value });
    this.setExport("useState", value => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = value;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    });
  }, { context });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => { assert.equal(specifier, "react"); return react; });
  await module.evaluate();
  const render = () => { stateIndex = refIndex = 0; return module.namespace.useIap(); };
  await render().refresh();
  return { api: module.namespace, hook: render(), window, calls, verifications, timers };
}

test("automatic restore cannot steal or remove a foreground purchase callback", async () => {
  const f = await fixture();
  const restore = f.api.autoRestoreEntitlement();
  await flush();
  const old = f.window.__STADY_IAP__;
  const purchase = f.hook.purchase("monthly");
  await flush();
  assert.deepEqual(f.calls, ["restore"]);
  old.onResult({ ok: false, platform: "google", error: "nothing to restore" });
  await restore;
  await flush();
  assert.deepEqual(f.calls, ["restore", "purchase"]);
  const current = f.window.__STADY_IAP__;
  assert.notEqual(current, old);
  old.onResult({ ok: false, error: "late duplicate" });
  assert.equal(f.window.__STADY_IAP__, current);
  current.onResult({ ok: true, platform: "google", purchaseToken: "test-only-purchase" });
  await purchase;
  assert.equal(f.verifications.length, 1);
  assert.equal(f.verifications[0].url, "/api/iap/google/verify");
  assert.equal(f.verifications[0].payload.purchaseToken, "test-only-purchase");
  assert.equal(f.timers.size, 0);
});

test("automatic restore timeout releases a queued purchase", async () => {
  const f = await fixture();
  const restore = f.api.autoRestoreEntitlement();
  await flush();
  const purchase = f.hook.purchase("monthly");
  await flush();
  [...f.timers.values()].find(t => t.ms === 30_000).fn();
  await restore;
  await flush();
  assert.deepEqual(f.calls, ["restore", "purchase"]);
  f.window.__STADY_IAP__.onResult({ ok: false, error: "cancelled" });
  await purchase;
  assert.equal(f.timers.size, 0);
});

test("bridge errors and unsupported restore reject immediately without stale timers", async () => {
  const f = await fixture({ dispatchThrows: true, restoreSupported: false });
  await assert.rejects(f.hook.purchase("monthly"), /Bridge unavailable/);
  await assert.rejects(f.hook.restore(), /최신 앱/);
  assert.equal(f.window.__STADY_IAP__, undefined);
  assert.equal(f.timers.size, 0);
});

test("malformed native JSON rejects and allows a subsequent operation", async () => {
  const f = await fixture();
  const purchase = f.hook.purchase("monthly");
  await flush();
  f.window.__STADY_IAP__.onResult("{invalid");
  await assert.rejects(purchase, /결제 응답/);
  const restore = f.hook.restore();
  await flush();
  f.window.__STADY_IAP__.onResult({ ok: false, error: "nothing to restore" });
  await restore;
  assert.equal(f.timers.size, 0);
});

test("already-owned recovery and the Apple bridge retain receipt verification", async () => {
  const f = await fixture();
  const purchase = f.hook.purchase("monthly");
  await flush();
  f.window.__STADY_IAP__.onResult({ ok: false, code: "7" });
  await flush();
  f.window.__STADY_IAP__.onResult({ ok: true, platform: "google", purchaseToken: "test-only-restored" });
  await purchase;
  assert.deepEqual(f.calls, ["purchase", "restore"]);
  assert.equal(f.verifications.length, 1);
  const apple = await fixture({ platform: "apple" });
  const applePurchase = apple.hook.purchase("monthly");
  await flush();
  apple.window.__STADY_IAP__.onResult({ ok: true, platform: "apple", transactionId: "test-only-transaction" });
  await applePurchase;
  assert.equal(apple.verifications[0].url, "/api/iap/apple/verify");
  assert.equal(apple.timers.size, 0);
});
