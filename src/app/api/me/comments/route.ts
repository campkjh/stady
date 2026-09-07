import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMyComments } from "@/lib/community";

// 내가 쓴 댓글 목록(마이페이지 '내가 쓴 글·댓글'). 최신순.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const comments = await listMyComments(user.id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("me/comments GET error:", error);
    return NextResponse.json({ error: "댓글을 불러오지 못했습니다." }, { status: 500 });
  }
}
