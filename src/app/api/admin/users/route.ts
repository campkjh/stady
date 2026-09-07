import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminUserStats, getAdminUsersPage } from "@/lib/user-admin-profile";

export const dynamic = "force-dynamic";

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

// GET ?q=검색어&page=1&limit=50 — 페이지 단위 목록 + 전체 수 + 요약 통계.
// 예전엔 7천 명 전체(+avatar·UA)를 한 번에 내려 6.5MB/9초였다.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q") ?? "";
    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "50");

    const [pageResult, stats] = await Promise.all([
      getAdminUsersPage({ q, page, limit }),
      getAdminUserStats(),
    ]);

    return NextResponse.json({
      users: pageResult.users.map((user) => ({
        ...user,
        attemptCount: toNumber(user.attemptCount),
        inquiryCount: toNumber(user.inquiryCount),
        totalStudySeconds: toNumber(user.totalStudySeconds),
      })),
      total: pageResult.total,
      page: pageResult.page,
      limit: pageResult.limit,
      stats,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
