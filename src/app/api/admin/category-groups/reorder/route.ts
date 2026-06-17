import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCategoryGroups, mapGroup, reorderCategoryGroups } from "@/lib/community";

interface ReorderItem {
  id: string;
  sortOrder?: number;
}

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin category group reorder API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const items: ReorderItem[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ error: "정렬할 항목이 없습니다." }, { status: 400 });
    }

    await reorderCategoryGroups(
      items.map((item, index) => ({
        id: String(item.id),
        sortOrder: Number(item.sortOrder ?? index),
      }))
    );

    const groups = await getCategoryGroups({ activeOnly: false });
    return NextResponse.json({ groups: groups.map(mapGroup) });
  } catch (error) {
    return adminError(error);
  }
}
