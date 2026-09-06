import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteHighlight, updateHighlight } from "@/lib/stories";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("admin/stories/[id] error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    await updateHighlight(id, {
      title: body?.title !== undefined ? String(body.title).trim() : undefined,
      coverUrl: body?.coverUrl !== undefined ? String(body.coverUrl).trim() : undefined,
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls.map(String) : undefined,
      sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) || 0 : undefined,
      isActive: body?.isActive !== undefined ? body.isActive === true : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteHighlight(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
