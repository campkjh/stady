import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleCommunityPostLike } from "@/lib/community";

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
    const result = await toggleCommunityPostLike(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("Community post like POST error:", error);
    return NextResponse.json({ error: "공감을 처리하지 못했습니다." }, { status: 500 });
  }
}
