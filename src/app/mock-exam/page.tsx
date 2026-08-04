import BackHeader from "@/components/BackHeader";
import MockExamBrowser, { type BrowserExam } from "@/components/MockExamBrowser";
import { listMockExams } from "@/lib/mockExam";
import { yearOptions } from "@/lib/examSubjects";

export const dynamic = "force-dynamic";

export default async function MockExamListPage() {
  const exams = await listMockExams(true);
  // 연도 목록은 서버에서 만들어 넘긴다(클라이언트에서 new Date()를 쓰면 하이드레이션 불일치).
  const years = yearOptions(exams.map((e) => e.year).filter((y): y is number => typeof y === "number"));

  const items: BrowserExam[] = exams.map((e) => ({
    id: e.id,
    title: e.title,
    subtitle: e.subtitle,
    coverUrl: e.imageUrls[0] ?? null,
    pageCount: e.imageUrls.length,
    solutionCount: e.solutionImageUrls.length,
    year: e.year,
    month: e.month,
    subject: e.subject,
  }));

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="모의고사" />
      <MockExamBrowser exams={items} years={years} />
    </div>
  );
}
