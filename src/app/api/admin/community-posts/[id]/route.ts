import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  adminUpdateCommunityPost,
  adminSetCommunityPostActive,
  adminDeleteCommunityPost,
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
  console.error("Admin community post API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

// 게시글 수정 / 노출 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { title, content, groupId, isActive } = body ?? {};

    // 노출 토글만 보낸 경우
    if (
      isActive !== undefined &&
      title === undefined &&
      content === undefined &&
      groupId === undefined
    ) {
      await adminSetCommunityPostActive(id, !!isActive);
      return NextResponse.json({ success: true });
    }

    if (title !== undefined && String(title).trim().length === 0) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }
    if (content !== undefined && String(content).trim().length === 0) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    await adminUpdateCommunityPost(id, {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(content !== undefined ? { content: String(content).trim() } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminError(error);
  }
}

// 게시글 영구 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await adminDeleteCommunityPost(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminError(error);
  }
}
