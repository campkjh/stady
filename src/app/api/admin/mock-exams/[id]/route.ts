import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateMockExam, deleteMockExam } from "@/lib/mockExam";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin mock-exam [id] error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await updateMockExam(id, {
      ...(body?.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body?.subtitle !== undefined ? { subtitle: body.subtitle ? String(body.subtitle).trim() : null } : {}),
      ...(body?.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
      ...(body?.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(Array.isArray(body?.imageUrls)
        ? { imageUrls: body.imageUrls.map((u: unknown) => String(u || "").trim()).filter((u: string) => /^https?:\/\//.test(u)).slice(0, 50) }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteMockExam(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
