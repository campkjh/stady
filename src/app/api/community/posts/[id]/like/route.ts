import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setCommunityPostReaction } from "@/lib/community";

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
    // Body: { type } picks one of the 6 reactions; { type: null } removes it.
    // No body / no `type` key falls back to a heart toggle (legacy behaviour).
    let type: string | null | undefined;
    try {
      const body = await request.json();
      type = body?.type;
    } catch {
      type = undefined;
    }
    if (type === undefined) {
      // legacy toggle: if already reacted, remove; else heart
      const { getPostReactions } = await import("@/lib/community");
      const current = await getPostReactions(id, user.id);
      type = current.myReaction ? null : "heart";
    }

    const result = await setCommunityPostReaction(id, user.id, type);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CommunityPostNotFound") {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("Community post like POST error:", error);
    return NextResponse.json({ error: "공감을 처리하지 못했습니다." }, { status: 500 });
  }
}
