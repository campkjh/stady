import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateOwnCommunityComment, deleteOwnCommunityComment } from "@/lib/community";

// 본인 댓글 수정(PATCH {content}) / 삭제(DELETE). 관리자는 남의 댓글도 가능.
function mapError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "CommunityCommentNotFound") return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
    if (error.message === "CommunityForbidden") return NextResponse.json({ error: "내 댓글만 수정·삭제할 수 있습니다." }, { status: 403 });
  }
  console.error("Community comment mutate error:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const content = String((body as { content?: unknown }).content ?? "").trim();
    if (!content) return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: "댓글은 2000자까지 쓸 수 있어요." }, { status: 400 });
    await updateOwnCommunityComment(id, user.id, content, user.role === "admin");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error, "댓글을 수정하지 못했습니다.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await params;
    await deleteOwnCommunityComment(id, user.id, user.role === "admin");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error, "댓글을 삭제하지 못했습니다.");
  }
}
