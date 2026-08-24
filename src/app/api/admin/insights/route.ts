import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getInsights, parseInsightDays } from "@/lib/insights";

// 어드민 인사이트: 페이지 체류 · 시간대별 활동 · 많이 푸는 문제 집계.
// 권한은 다른 어드민 API 와 동일하게 requireAdmin() 이 던지는 Unauthorized/Forbidden 으로 맞춘다.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const days = parseInsightDays(new URL(request.url).searchParams.get("days"));
    const data = await getInsights(days);
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin insights GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
