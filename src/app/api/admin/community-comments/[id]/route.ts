import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  adminSetCommunityCommentActive,
  adminUpdateCommunityCommentContent,
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

// 댓글 노출/비노출 토글 또는 내용 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { isActive, content } = (await request.json()) ?? {};
    if (isActive === undefined && content === undefined) {
      return NextResponse.json({ error: "isActive 또는 content가 필요합니다." }, { status: 400 });
    }
    if (content !== undefined) {
      const trimmed = String(content).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
      }
      await adminUpdateCommunityCommentContent(id, trimmed);
    }
    if (isActive !== undefined) {
      await adminSetCommunityCommentActive(id, !!isActive);
    }
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
