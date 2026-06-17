import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCommunityComment } from "@/lib/community";

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (error.message === "CommunityParentCommentNotFound") {
      return NextResponse.json({ error: "답글을 달 댓글을 찾을 수 없습니다." }, { status: 404 });
    }
  }
  console.error("Community comment POST error:", error);
  return NextResponse.json({ error: "댓글을 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await request.json();
    const content = String(body.content || "").trim();
    const parentId = body.parentId ? String(body.parentId) : null;

    if (!content) {
      return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
    }

    const id = await createCommunityComment({
      postId,
      userId: user.id,
      parentId,
      content,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
