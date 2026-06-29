import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listSiteContent, createSiteContent, type ContentKind } from "@/lib/siteContent";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin site-content error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function parseKind(value: string | null): ContentKind | null {
  return value === "notice" || value === "faq" ? value : null;
}

// 어드민: 공지/FAQ 목록(비활성 포함).
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const kind = parseKind(new URL(request.url).searchParams.get("kind"));
    if (!kind) return NextResponse.json({ error: "kind가 올바르지 않습니다." }, { status: 400 });
    const items = await listSiteContent(kind);
    return NextResponse.json({ items });
  } catch (error) {
    return adminError(error);
  }
}

// 어드민: 공지/FAQ 추가.
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const kind = parseKind(body?.kind);
    if (!kind) return NextResponse.json({ error: "kind가 올바르지 않습니다." }, { status: 400 });
    const title = String(body?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    await createSiteContent({
      kind,
      title,
      body: String(body?.body ?? "").trim(),
      dateLabel: body?.dateLabel ? String(body.dateLabel).trim() : null,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
      isActive: body?.isActive !== false,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}
