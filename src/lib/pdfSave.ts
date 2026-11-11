"use client";

// PDF 를 기기에 저장·인쇄할 수 있게 넘긴다(MockExamPdfButton 이 시험지+해설을 한꺼번에 받을 때 쓴다).
//  · 아이폰 앱 WKWebView: 다운로드를 처리하는 네이티브 코드가 없어 링크로 열면 앱 화면이 PDF 로 바뀌기만 한다
//    → 공유 시트(navigator.share files)로 파일에 저장·인쇄. 공유 시트는 '사용자가 누른 순간'에만 열린다.
//  · 안드로이드 앱 WebView: 공유도 blob 저장도 막혀 있어 다운로드 주소로 이동(앱이 다운로드를 받아 준다).
//  · 그 밖(데스크톱·브라우저): 받아 둔 파일을 a[download] 로 저장.

export function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) && /; wv\)/.test(navigator.userAgent);
}

/** 스타디 아이폰 앱(WKWebView) — 다운로드를 처리하는 네이티브 코드가 없어 공유 시트로만 저장할 수 있다. */
export function isIosApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { webkit?: { messageHandlers?: Record<string, unknown> } };
  return !!w.webkit?.messageHandlers?.requestReview;
}

/** 파일을 미리 받아 둔다. 실패하면 오류 메시지를 던진다. */
export async function fetchPdfFile(url: string, fileName: string): Promise<File> {
  // Keep cookies for our premium check, but omit them after the Blob redirect.
  // Blob allows CORS with '*', which browsers reject with credentials: 'include'.
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "PDF를 받지 못했어요.");
  }
  const blob = await res.blob();
  return new File([blob], fileName, { type: "application/pdf" });
}

/** 받아 둔 파일들을 바로 기기에 저장한다(a[download], 공유 시트 없이). */
export function downloadFiles(files: File[]) {
  files.forEach((file, i) => {
    // 한꺼번에 누르면 브라우저가 두 번째를 놓치는 일이 있어 살짝 간격을 둔다.
    setTimeout(() => {
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    }, i * 400);
  });
}

/** 여러 파일을 공유 시트 하나로 연다. 누른 지 오래돼 거절되면 "blocked". */
export async function shareFiles(files: File[]): Promise<"shared" | "cancelled" | "blocked"> {
  try {
    if (typeof navigator.share !== "function" || !navigator.canShare?.({ files })) return "blocked";
    // title 은 넘기지 않는다 — 아이폰 공유 시트가 그 글자를 '텍스트' 파일로 같이 저장한다(엘리트 신고).
    await navigator.share({ files });
    return "shared";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "cancelled";
    return "blocked";
  }
}
