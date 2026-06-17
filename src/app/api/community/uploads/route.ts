import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    // Android WebView may send images with an empty/generic MIME type, so fall
    // back to the file extension before rejecting.
    const looksLikeImage =
      file.type && file.type !== "application/octet-stream"
        ? file.type.startsWith("image/")
        : /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(file.name || "");
    if (!looksLikeImage) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지는 10MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, "-").slice(-80) || "image";
    const blob = await put(`community/${user.id}/${Date.now()}-${randomUUID()}-${safeName}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Community upload error:", error);
    return NextResponse.json({ error: "이미지 업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
