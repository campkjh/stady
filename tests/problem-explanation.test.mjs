import assert from "node:assert/strict";
import { test } from "node:test";
import { explanationImageUrl } from "../src/lib/problemExplanation.ts";

test("uploaded explanation photos are recognized without altering ordinary text", () => {
  const url = "https://example.public.blob.vercel-storage.com/corrections/q16.jpeg";
  assert.equal(explanationImageUrl(url), url);
  assert.equal(explanationImageUrl(` ${url} `), url);
  assert.equal(explanationImageUrl("Plain explanation\nSecond line"), null);
  assert.equal(explanationImageUrl(""), null);
  assert.equal(explanationImageUrl("<img src=x onerror=alert(1)>"), null);
});

test("only HTTPS raster images on the existing public Blob domain can be embedded", () => {
  for (const url of [
    "javascript:alert(1)", "data:image/svg+xml,<svg/>",
    "http://example.public.blob.vercel-storage.com/q16.jpeg",
    "https://evil.example/q16.jpeg",
    "https://example.public.blob.vercel-storage.com.evil.example/q16.jpeg",
    "https://user:password@example.public.blob.vercel-storage.com/q16.jpeg",
    "https://example.public.blob.vercel-storage.com/q16.svg",
    "https://example.public.blob.vercel-storage.com/q16.html",
  ]) assert.equal(explanationImageUrl(url), null, url);
});
