import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateSiteContent, deleteSiteContent, listSiteContent } from "@/lib/siteContent";
import { syncNoticeToCommunity, removeNoticeMirror } from "@/lib/noticeMirror";

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
    const admin = await requireAdmin();
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
      ...(body?.popupEnabled !== undefined ? { popupEnabled: Boolean(body.popupEnabled) } : {}),
      ...(body?.popupHideDays !== undefined ? { popupHideDays: Number(body.popupHideDays) || 7 } : {}),
    });
    // 공지 수정은 커뮤니티 미러 글에도 반영(제목/내용/이미지/노출).
    const updated = (await listSiteContent("notice")).find((it) => it.id === id);
    if (updated) {
      await syncNoticeToCommunity({
        contentId: updated.id,
        title: updated.title,
        body: updated.body,
        imageUrls: updated.imageUrls,
        authorId: admin.id,
        isActive: updated.isActive,
      });
    }
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
    await removeNoticeMirror(id);
    await deleteSiteContent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
