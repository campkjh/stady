"use client";

import { useEffect, useState } from "react";

// Detects iPad / large tablets so we can show the 50/50 split solve+memo layout
// and handwriting tools only where they make sense. iPadOS 13+ reports a
// "Macintosh" UA, so we also check for touch points to catch it.
// The iOS WKWebView wrapper injects the real device idiom at document start
// (see ios/WebView.swift), because its forced iPhone UA hides whether we're on
// an iPad. When present, this is authoritative and we don't have to guess.
declare global {
  interface Window {
    __STADY_NATIVE__?: { idiom?: "pad" | "phone" };
  }
}

function detectTablet(): boolean {
  if (typeof window === "undefined") return false;
  const nativeIdiom = window.__STADY_NATIVE__?.idiom;
  if (nativeIdiom === "pad") return true;
  if (nativeIdiom === "phone") return false;
  const ua = navigator.userAgent || "";
  const platform = typeof navigator.platform === "string" ? navigator.platform : "";
  // NOTE: the iOS WKWebView wrapper forces an iPhone User-Agent (for KakaoTalk
  // login), so UA alone can't tell an iPad apart. navigator.platform is NOT
  // spoofed, so on iPadOS it still reads "iPad" or "MacIntel" with touch.
  const isIPad =
    /iPad/.test(ua) ||
    /iPad/.test(platform) ||
    ((/Macintosh/.test(ua) || platform === "MacIntel") && navigator.maxTouchPoints > 1);
  const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);
  const hasTouch =
    navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
  const minSide = Math.min(window.innerWidth, window.innerHeight);
  // Explicit tablet, or a touch device whose smaller side is iPad-mini-sized+
  // (iPad mini is 744pt wide; no phone reaches 700pt on its shorter side).
  return isIPad || isAndroidTablet || (hasTouch && minSide >= 700);
}

export function useIsTablet(): boolean {
  // Start false so SSR and the first client render match; flip after mount.
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const update = () => setIsTablet(detectTablet());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return isTablet;
}
