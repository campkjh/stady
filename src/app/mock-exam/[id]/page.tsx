import Link from "next/link";
import { getMockExam, getMockExamPdf } from "@/lib/mockExam";
import MockExamViewer from "@/components/MockExamViewer";
import PremiumRequired from "@/components/PremiumRequired";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";

export const dynamic = "force-dynamic";

export default async function MockExamViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exam, pdf] = await Promise.all([getMockExam(id), getMockExamPdf(id)]);

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

  return (
    <MockExamViewer
      exam={{
        id: exam.id,
        title: exam.title,
        subtitle: exam.subtitle,
        imageUrls: exam.imageUrls,
        lineBoxes: exam.lineBoxes,
        solutionImageUrls: exam.solutionImageUrls,
        solutionLineBoxes: exam.solutionLineBoxes,
      }}
      // 주소는 넘기지 않고 유무만 — 받기는 /api/mock-exams/[id]/pdf 가 프리미엄 확인 뒤 처리한다.
      pdf={pdf ? { problem: !!pdf.problemUrl, solution: !!pdf.solutionUrl } : undefined}
    />
  );
}
