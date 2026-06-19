import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  adminSetCommunityCommentActive,
  adminDeleteCommunityComment,
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
  console.error("Admin community comment API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

// 댓글 노출/비노출 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { isActive } = (await request.json()) ?? {};
    if (isActive === undefined) {
      return NextResponse.json({ error: "isActive는 필수입니다." }, { status: 400 });
    }
    await adminSetCommunityCommentActive(id, !!isActive);
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminError(error);
  }
}

// 댓글 영구 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await adminDeleteCommunityComment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminError(error);
  }
}
