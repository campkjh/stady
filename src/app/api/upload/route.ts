import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    // 경로에 Date.now() 가 박혀 URL 이 불변이므로 1년 캐시가 안전하다(기본값은 30일).
    // 만료 후 재요청은 CDN MISS 가 되어 Origin Transfer 단가가 붙는다.
    // ⚠️ 여기(problems/)는 모의고사 시험지·문제집 이미지 경로다. MockExamViewer 가
    // naturalWidth 기준으로 OCR 크롭·필기 캔버스 정렬을 하고 4배 확대를 지원하므로
    // 이 라우트에는 리사이즈/재인코딩을 넣지 말 것.
    const blob = await put(`problems/${Date.now()}-${file.name}`, file, {
      access: "public",
      cacheControlMaxAge: 365 * 24 * 60 * 60,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("Upload error:", error);
    return NextResponse.json({ error: "업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
