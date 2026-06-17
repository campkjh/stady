import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleCommunityCommentLike } from "@/lib/community";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const result = await toggleCommunityCommentLike(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CommunityCommentNotFound") {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("Community comment like POST error:", error);
    return NextResponse.json({ error: "댓글 공감을 처리하지 못했습니다." }, { status: 500 });
  }
}
