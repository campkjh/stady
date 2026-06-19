import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminComments } from "@/lib/community";

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin community comments API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const comments = await getAdminComments();
    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        postId: c.post_id,
        postTitle: c.post_title,
        parentId: c.parent_id,
        userId: c.user_id,
        nickname: c.nickname || "익명",
        content: c.content,
        isActive: c.is_active,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    return adminError(error);
  }
}
