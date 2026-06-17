import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteOrDeactivateTag, getTags, mapTag, normalizeSlug, updateTag } from "@/lib/community";

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin tag detail API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

function isUniqueError(error: unknown) {
  return error instanceof Error && /unique|duplicate/i.test(error.message);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const groupId = String(body.groupId || "");
    const name = String(body.name || "").trim();
    const slug = normalizeSlug(String(body.slug || body.name || ""));

    if (!groupId || !name || !slug) {
      return NextResponse.json({ error: "소속 카테고리, 이름, slug가 필요합니다." }, { status: 400 });
    }

    await updateTag(id, {
      groupId,
      name,
      slug,
      description: String(body.description || ""),
      isActive: body.isActive ?? true,
      sortOrder: Number(body.sortOrder ?? 0),
    });

    const tags = await getTags({ groupId, activeOnly: false });
    return NextResponse.json({ tags: tags.map(mapTag) });
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: "해당 카테고리에서 이미 사용 중인 slug입니다." }, { status: 409 });
    }
    return adminError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await deleteOrDeactivateTag(id);
    return NextResponse.json(result);
  } catch (error) {
    return adminError(error);
  }
}
