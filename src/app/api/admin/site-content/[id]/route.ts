import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateSiteContent, deleteSiteContent } from "@/lib/siteContent";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin site-content [id] error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// 어드민: 공지/FAQ 수정.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await updateSiteContent(id, {
      ...(body?.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body?.body !== undefined ? { body: String(body.body).trim() } : {}),
      ...(body?.dateLabel !== undefined ? { dateLabel: body.dateLabel ? String(body.dateLabel).trim() : null } : {}),
      ...(body?.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
      ...(body?.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(Array.isArray(body?.imageUrls)
        ? { imageUrls: body.imageUrls.map((u: unknown) => String(u || "").trim()).filter((u: string) => /^https?:\/\//.test(u)).slice(0, 10) }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}

// 어드민: 공지/FAQ 삭제.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteSiteContent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
