import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { voteCommunityPoll } from "@/lib/community";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const optionId = String(body?.optionId || "");
    if (!optionId) {
      return NextResponse.json({ error: "선택지를 골라주세요." }, { status: 400 });
    }

    const poll = await voteCommunityPoll(id, user.id, optionId);
    return NextResponse.json({ poll });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CommunityPostNotFound") {
        return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
      }
      if (error.message === "CommunityPollOptionNotFound") {
        return NextResponse.json({ error: "선택지를 찾을 수 없습니다." }, { status: 404 });
      }
    }
    console.error("Community poll vote POST error:", error);
    return NextResponse.json({ error: "투표를 처리하지 못했습니다." }, { status: 500 });
  }
}
