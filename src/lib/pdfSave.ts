"use client";

// PDF 를 기기에 저장·인쇄할 수 있게 넘긴다.
//  · 휴대폰·태블릿(아이폰 앱 WKWebView 포함): 공유 시트(navigator.share files) → 인쇄·파일에 저장·다른 앱으로 열기.
//    아이폰 앱은 다운로드를 처리하는 네이티브 코드가 없어서 링크로 열면 앱 화면이 PDF 로 바뀌기만 한다.
//    공유 시트는 '사용자가 누른 순간'에만 열리므로(받는 동안 기다리면 거절됨) 미리 받아 둔 File 로만 연다.
//  · 그 밖(데스크톱 등): 받아 둔 파일을 a[download] 로 저장.
//  · 안드로이드 앱 WebView: 공유도 blob 저장도 막혀 있어 다운로드 주소로 이동(앱이 다운로드를 받아 준다).

export function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) && /; wv\)/.test(navigator.userAgent);
}

function isTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad|Macintosh/i.test(navigator.userAgent);
}

/** 파일을 미리 받아 둔다. 실패하면 오류 메시지를 던진다. */
export async function fetchPdfFile(url: string, fileName: string): Promise<File> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "PDF를 받지 못했어요.");
  }
  const blob = await res.blob();
  return new File([blob], fileName, { type: "application/pdf" });
}

export function canShareFile(file: File): boolean {
  try {
    return isTouchDevice() && typeof navigator.share === "function" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/** 사용자가 버튼을 누른 그 순간(같은 이벤트 안)에 불러야 한다. */
export async function savePdfFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      // 공유가 막히면 아래 저장으로 넘어간다.
    }
  }
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return "downloaded";
}
