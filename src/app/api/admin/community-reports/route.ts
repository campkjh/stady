import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listCommunityReports, updateCommunityReportStatus } from "@/lib/community";

export const dynamic = "force-dynamic";

function adminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }
  console.error("Admin community reports API error:", error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}

// 접수된 신고 목록. 기본은 전체, ?status=접수 로 미처리만 볼 수 있다.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const status = new URL(request.url).searchParams.get("status");
    const rows = await listCommunityReports({ status });
    return NextResponse.json({
      reports: rows.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        postId: row.post_id,
        commentId: row.comment_id,
        reason: row.reason,
        detail: row.detail,
        status: row.status,
        createdAt: row.created_at,
        reporterNickname: row.reporter_nickname || "알 수 없음",
        targetNickname: row.target_nickname || "알 수 없음",
        postTitle: row.post_title,
        commentContent: row.comment_content,
        contentActive: row.content_active,
      })),
    });
  } catch (error) {
    return adminError(error);
  }
}

// 처리 상태 변경 (접수 → 처리완료 / 반려).
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const id = body.id ? String(body.id) : "";
    const status = String(body.status || "");
    if (!id || !["접수", "처리완료", "반려"].includes(status)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await updateCommunityReportStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
