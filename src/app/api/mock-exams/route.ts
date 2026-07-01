import { NextResponse } from "next/server";
import { listMockExams } from "@/lib/mockExam";

// 공개: 노출 중인 모의고사 목록.
export async function GET() {
  try {
    const exams = await listMockExams(true);
    return NextResponse.json({ exams });
  } catch (error) {
    console.error("Mock exams GET error:", error);
    return NextResponse.json({ exams: [] });
  }
}
