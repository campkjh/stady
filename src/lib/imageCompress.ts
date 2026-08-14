// 업로드 전에 브라우저에서 이미지를 축소·재인코딩한다.
//
// 왜: 커뮤니티 이미지가 폰 원본 그대로(최대 4.2MB) 저장되고, 목록·상세에서 그 원본을
// 그대로 다시 내려받는다. 저장 비용은 무시할 수준이지만 조회 트래픽(Blob Data Transfer)이
// 지배적인 비용 항목이라, 업로드 시점에 한 번 줄여두면 이후 모든 조회에 곱해져 절감된다.
//
// ⚠️ 이 함수는 절대 throw 하지 않는다. 조금이라도 미심쩍으면 원본 File 을 그대로 돌려준다.
// 안드로이드 WebView / 구형 WKWebView 에서 디코딩이 안 되는 포맷(HEIC 등)이 실제로 있고,
// 그 경우 "압축 실패"가 아니라 "지금까지와 똑같이 원본 업로드"가 되어야 회귀가 없다.
//
// 손대지 않는 것:
//  - GIF: 재인코딩하면 애니메이션이 첫 프레임으로 죽는다.
//  - SVG: 래스터화하면 벡터성이 사라진다.
//  - 모의고사 시험지(/api/upload 경로): 원본 해상도가 기능이다. MockExamViewer 가
//    naturalWidth 기준으로 OCR 크롭·필기 캔버스 정렬을 하고 4배 확대를 지원하므로
//    해상도를 건드리면 조용히 깨진다. 그래서 이 헬퍼는 커뮤니티 업로드에서만 쓴다.

// 긴 변 상한. 상세 화면이 태블릿에서 max-height 620px(DPR2 → 1240px)를 요구하므로
// 1600이면 확대 없이 충분하고, 목록 썸네일(2열 ~150CSS px)에는 넉넉하다.
const MAX_SIDE = 1600;
// 이미 충분히 작으면 건드리지 않는다(재인코딩은 화질만 깎이고 이득이 없다).
const SKIP_BELOW_BYTES = 400 * 1024;
// 최소 이 정도는 줄어야 재인코딩본을 채택한다. 이득이 적으면 원본이 낫다.
const MIN_GAIN = 0.15;
const QUALITY = 0.85;
// 무손실 결과가 이보다 작으면 더 볼 것 없이 채택한다(스크린샷·도표류가 여기 걸린다).
const LOSSLESS_ACCEPT = 400 * 1024;

function isSkippedType(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (type === "image/gif" || name.endsWith(".gif")) return true;
  if (type === "image/svg+xml" || name.endsWith(".svg")) return true;
  return false;
}

// PNG 로 올라온 건 대체로 사진이 아니라 스크린샷·문제 캡처·도표다.
// 이런 이미지는 무손실 WebP 가 lossy 보다 오히려 작고(실측 2000x1500 텍스트 캡처에서
// lossy q0.85 268KB vs 무손실 65KB) 글자도 안 뭉갠다. 반대로 사진에 무손실을 쓰면
// 13배 커지므로(실측 73KB → 985KB) 소스 종류로 갈라야 한다.
function looksLikeGraphic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "image/png" || name.endsWith(".png");
}

function renameTo(name: string, ext: string): string {
  const base = (name || "image").replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.${ext}`;
}

// OffscreenCanvas.convertToBlob 은 같은 입력에서 toBlob 보다 일관되게 느렸고(실측 약 1.3~1.5배)
// 메인 스레드에서 부르는 한 이점도 없어서 일반 canvas 만 쓴다.
function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

// 후보를 만들어 가장 작은 것을 고른다. 구형 Safari 는 요청한 타입을 무시하고 PNG 를
// 돌려주므로 결과의 실제 type 을 반드시 확인한다.
async function encodeBest(canvas: HTMLCanvasElement, graphic: boolean): Promise<Blob | null> {
  const candidates: Blob[] = [];

  if (graphic) {
    const lossless = await encode(canvas, "image/webp", 1);
    if (lossless?.type === "image/webp") {
      if (lossless.size <= LOSSLESS_ACCEPT) return lossless;
      candidates.push(lossless);
    }
  }

  const lossy = await encode(canvas, "image/webp", QUALITY);
  if (lossy?.type === "image/webp") candidates.push(lossy);

  if (candidates.length === 0) {
    const jpeg = await encode(canvas, "image/jpeg", QUALITY);
    if (jpeg?.type === "image/jpeg") candidates.push(jpeg);
  }

  candidates.sort((a, b) => a.size - b.size);
  return candidates[0] ?? null;
}

/**
 * 업로드용으로 축소된 File 을 돌려준다. 불가능하거나 이득이 없으면 원본을 그대로 돌려준다.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  try {
    if (isSkippedType(file)) return file;
    // createImageBitmap 이 없으면 압축을 포기한다. <img> 로 우회할 수도 있지만
    // 그 경로는 EXIF 방향 적용이 브라우저마다 달라 사진이 눕는 사고가 난다.
    if (typeof createImageBitmap !== "function") return file;

    let bitmap: ImageBitmap;
    try {
      // imageOrientation: "from-image" 로 EXIF 회전을 픽셀에 굽는다.
      // (모르는 옵션은 무시되므로 구형에서도 안전하다.)
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // HEIC/HEIF 등 이 브라우저가 못 읽는 포맷 → 지금까지처럼 원본 업로드.
      return file;
    }

    const { width, height } = bitmap;
    if (!width || !height) {
      bitmap.close?.();
      return file;
    }

    const longSide = Math.max(width, height);
    // 이미 작고 해상도도 과하지 않으면 그대로 둔다.
    if (longSide <= MAX_SIDE && file.size <= SKIP_BELOW_BYTES) {
      bitmap.close?.();
      return file;
    }

    const scale = Math.min(1, MAX_SIDE / longSide);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const out = await encodeBest(canvas, looksLikeGraphic(file));
    if (!out || !out.size) return file;
    // 충분히 줄지 않았으면 원본이 낫다(화질 손실만 남는다).
    if (out.size > file.size * (1 - MIN_GAIN)) return file;

    return new File([out], renameTo(file.name, out.type === "image/webp" ? "webp" : "jpg"), {
      type: out.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
