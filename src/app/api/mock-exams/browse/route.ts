import { NextResponse } from "next/server";
import { listMockExams } from "@/lib/mockExam";
import { yearOptions } from "@/lib/examSubjects";
import { examIdsWithQuestions } from "@/lib/mockExamQuestion";

export const dynamic = "force-dynamic";

// 홈(태블릿)의 모의고사 섹션용 가벼운 목록 — 카드에 필요한 필드만(이미지 주소 배열 통째로 보내지 않는다).
// 카드 순서는 최근 회차 먼저, 한 회차 안에서는 목록 화면과 같은 과목 순서(sort_order).
export async function GET() {
  try {
    const raw = await listMockExams(true);
    const withQuestions = await examIdsWithQuestions(raw.map((e) => e.id));
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const exams = [...raw]
      .sort((a, b) => (day(a.createdAt) === day(b.createdAt) ? a.sortOrder - b.sortOrder : day(b.createdAt).localeCompare(day(a.createdAt))))
      .map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: e.subtitle,
        coverUrl: e.imageUrls[0] ?? null,
        pageCount: e.imageUrls.length,
        solutionCount: e.solutionImageUrls.length,
        year: e.year,
        month: e.month,
        subject: e.subject,
        hasQuestions: withQuestions.has(e.id),
      }));
    const years = yearOptions(raw.map((e) => e.year).filter((y): y is number => typeof y === "number"));
    return NextResponse.json({ exams, years });
  } catch (error) {
    console.error("Mock exams browse GET error:", error);
    return NextResponse.json({ exams: [], years: [] });
  }
}
