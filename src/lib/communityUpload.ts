import { compressImageForUpload } from "@/lib/imageCompress";

// 커뮤니티 이미지 업로드 공용 경로. 글쓰기 폼과 글 수정 폼이 같은 규칙을 쓰도록 모아둔다.
//
// 두 가지를 여기서 해결한다.
//  1) 업로드 전 클라이언트 축소 — 조회 트래픽이 지배적 비용이라 한 번 줄이면 이후 모든 조회에 곱해진다.
//  2) 프리뷰를 방금 고른 파일로(objectURL) — 예전엔 업로드 직후 서버 blob URL 을 <img src> 로 써서
//     방금 올린 바이트를 그대로 되받았다(업로드 1건 = 왕복 2배). 프리뷰는 로컬 파일로 충분하다.

// Vercel Functions 요청 바디 상한(4.5MB). 초과하면 라우트에 닿기도 전에
// 플랫폼이 비-JSON 413 을 돌려줘서 response.json() 이 SyntaxError 로 터진다.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface CommunityUpload {
  /** 서버에 저장된 blob URL. 글 저장 시 서버로 보내는 값. */
  url: string;
  /** 화면 미리보기용 로컬 objectURL. 다 쓰면 revokeUploadPreview 로 해제할 것. */
  previewUrl: string;
  name: string;
}

export function revokeUploadPreview(previewUrl: string | undefined | null) {
  if (!previewUrl || !previewUrl.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(previewUrl);
  } catch {
    /* ignore */
  }
}

export async function uploadCommunityImage(original: File): Promise<CommunityUpload> {
  // 실패해도 원본 File 이 그대로 돌아온다(HEIC 등) — 그 경우 예전과 동일하게 동작한다.
  const file = await compressImageForUpload(original);

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("이미지 용량이 너무 큽니다. 4MB 이하로 줄여서 올려주세요.");
  }

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/community/uploads", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  // 플랫폼이 막은 경우(413 등) 본문이 JSON 이 아니라 json() 이 터진다 → 안내 문구로 바꾼다.
  let data: { url?: string; error?: string } | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || !data?.url) {
    throw new Error(
      data?.error ||
        (response.status === 413
          ? "이미지 용량이 너무 큽니다. 더 작은 이미지를 올려주세요."
          : "이미지 업로드에 실패했습니다.")
    );
  }

  return {
    url: data.url,
    previewUrl: URL.createObjectURL(file),
    name: original.name,
  };
}
