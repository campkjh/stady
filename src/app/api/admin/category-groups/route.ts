import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createCategoryGroup,
  getCategoryGroups,
  mapGroup,
  normalizeSlug,
} from "@/lib/community";

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin category groups API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

function isUniqueError(error: unknown) {
  return error instanceof Error && /unique|duplicate/i.test(error.message);
}

export async function GET() {
  try {
    await requireAdmin();
    const groups = await getCategoryGroups({ activeOnly: false });
    return NextResponse.json({ groups: groups.map(mapGroup) });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const slug = normalizeSlug(String(body.slug || body.name || ""));

    if (!name || !slug) {
      return NextResponse.json({ error: "이름과 slug가 필요합니다." }, { status: 400 });
    }

    const id = await createCategoryGroup({
      name,
      slug,
      description: String(body.description || ""),
      isActive: body.isActive ?? true,
      sortOrder: Number(body.sortOrder ?? 0),
    });

    const groups = await getCategoryGroups({ activeOnly: false });
    return NextResponse.json({ id, groups: groups.map(mapGroup) }, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: "이미 사용 중인 slug입니다." }, { status: 409 });
    }
    return adminError(error);
  }
}
