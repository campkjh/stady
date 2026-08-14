"use client";

// 커뮤니티 업로드 이미지를 브라우저에서 리사이즈·재인코딩해 용량을 줄인다.
// 목적: Vercel Blob 저장 용량 + 업로드/다운로드 대역폭 동시 절감(서버비↓).
//
// 안전 폴백 원칙 — 아래 경우엔 원본을 그대로 반환한다(업로드 실패 없이):
//   · GIF/SVG (애니메이션·벡터 손상 방지)  · 이미 충분히 작은 파일
//   · 캔버스 디코드 불가(일부 Android WebView의 HEIC 등)  · 결과가 더 커질 때
// EXIF 회전은 createImageBitmap({imageOrientation:"from-image"}) / <img> 기본값으로 보정.

export interface CompressOptions {
  /** 긴 변 최대 픽셀. 기본 1600 (본문 스크린샷 글자 가독성 유지) */
  maxDimension?: number;
  /** JPEG 품질 0~1. 기본 0.8 */
  quality?: number;
  /** 이 크기(byte) 이하면 압축 없이 원본 사용. 기본 300KB */
  skipUnderBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.8,
  skipUnderBytes: 300 * 1024,
};

function shouldSkip(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    type === "image/gif" ||
    name.endsWith(".gif") ||
    type === "image/svg+xml" ||
    name.endsWith(".svg")
  );
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeImage(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
    } catch {
      /* HEIC 등 디코드 실패 → <img> 폴백 (iOS WKWebView는 여기서 HEIC 디코드됨) */
    }
  }
  return await new Promise<Decoded | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * 이미지 파일을 압축해 새 File 로 돌려준다. 어떤 실패든 원본 File 을 반환하므로
 * 호출부는 결과를 그대로 업로드하면 된다.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality, skipUnderBytes } = { ...DEFAULTS, ...options };
  try {
    if (typeof document === "undefined") return file; // SSR 안전장치
    if (shouldSkip(file)) return file;
    if (file.size <= skipUnderBytes) return file;

    const decoded = await decodeImage(file);
    if (!decoded) return file;
    const { source, width, height, cleanup } = decoded;
    if (!width || !height) {
      cleanup();
      return file;
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return file;
    }
    // JPEG 는 알파가 없으므로 투명 영역이 검게 나오지 않게 흰 배경을 깔고 그린다.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    cleanup();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // 더 커지면 원본 유지

    const base = (file.name || "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file; // 어떤 실패든 원본 업로드는 보장
  }
}
