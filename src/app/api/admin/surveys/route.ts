import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllSurveys } from "@/lib/survey";

// 어드민: 온보딩 설문 응답 전체 조회.
export async function GET() {
  try {
    await requireAdmin();
    const surveys = await getAllSurveys();
    return NextResponse.json({ surveys });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin surveys GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
