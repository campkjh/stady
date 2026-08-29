import Link from "next/link";
import { getMockExam } from "@/lib/mockExam";
import MockExamSolver from "@/components/MockExamSolver";
import PremiumRequired from "@/components/PremiumRequired";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";

export const dynamic = "force-dynamic";

// 문항 단위 풀이 화면(모바일). 시험지 위에 필기하는 태블릿 뷰어는 /mock-exam/[id] 쪽이다.
export default async function MockExamSolvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await getMockExam(id);

  // 모의고사는 전부 프리미엄 전용.
  if (!(await viewerHasPremiumAccess())) {
    return <PremiumRequired />;
  }

  if (!exam || !exam.isActive) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "var(--c-bg)", padding: 24 }}>
        <p style={{ color: "var(--c-text-4)", fontSize: 15 }}>모의고사를 찾을 수 없습니다.</p>
        <Link href="/mock-exam" style={{ color: "var(--c-brand)", fontWeight: 700, textDecoration: "none" }}>목록으로</Link>
      </div>
    );
  }

  return <MockExamSolver examId={exam.id} title={exam.title} subtitle={exam.subtitle} />;
}
