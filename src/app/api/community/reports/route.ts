import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { COMMUNITY_REPORT_REASONS, createCommunityReport } from "@/lib/community";

export const dynamic = "force-dynamic";

// 사용자 신고 접수 (App Store 가이드라인 1.2 — UGC 신고 수단).
// 같은 대상을 두 번 신고해도 오류 없이 접수 처리한다(중복은 DB에서 무시).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const targetType = body.targetType === "comment" ? "comment" : "post";
  const reason = String(body.reason || "");
  if (!COMMUNITY_REPORT_REASONS.includes(reason as never)) {
    return NextResponse.json({ error: "신고 사유를 선택해 주세요." }, { status: 400 });
  }

  try {
    await createCommunityReport({
      reporterId: user.id,
      targetType,
      postId: body.postId ? String(body.postId) : null,
      commentId: body.commentId ? String(body.commentId) : null,
      reason,
      detail: body.detail ? String(body.detail) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CommunityReportSelf") {
      return NextResponse.json({ error: "내가 쓴 글은 신고할 수 없어요." }, { status: 400 });
    }
    if (message === "CommunityReportTargetMissing") {
      return NextResponse.json({ error: "이미 삭제된 게시물이에요." }, { status: 404 });
    }
    console.error("community report error:", error);
    return NextResponse.json({ error: "신고를 접수하지 못했습니다." }, { status: 500 });
  }
}
