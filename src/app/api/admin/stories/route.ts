import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createHighlight, listHighlights } from "@/lib/stories";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("admin/stories error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ highlights: await listHighlights(false) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const coverUrl = String(body?.coverUrl || "").trim();
    const imageUrls: string[] = Array.isArray(body?.imageUrls) ? body.imageUrls.map(String) : [];
    if (!title) return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
    if (!coverUrl) return NextResponse.json({ error: "커버 이미지를 올려 주세요." }, { status: 400 });
    if (imageUrls.length === 0) return NextResponse.json({ error: "후기 이미지를 1장 이상 올려 주세요." }, { status: 400 });
    const id = await createHighlight({ title, coverUrl, imageUrls, sortOrder: Number(body?.sortOrder) || 0 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return fail(error);
  }
}
