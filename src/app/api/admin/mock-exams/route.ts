import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listMockExams, createMockExam } from "@/lib/mockExam";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Admin mock-exams error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function parseImageUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((u) => String(u || "").trim()).filter((u) => /^https?:\/\//.test(u)).slice(0, 50)
    : [];
}

export async function GET() {
  try {
    await requireAdmin();
    const exams = await listMockExams();
    return NextResponse.json({ exams });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    await createMockExam({
      title,
      subtitle: body?.subtitle ? String(body.subtitle).trim() : null,
      imageUrls: parseImageUrls(body?.imageUrls),
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
      isActive: body?.isActive !== false,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}
