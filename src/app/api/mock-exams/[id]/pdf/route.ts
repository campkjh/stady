import { NextRequest, NextResponse } from "next/server";
import { getMockExam, getMockExamPdf } from "@/lib/mockExam";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 모의고사 원본 PDF 받기(인쇄·한 번에 보기용). 모의고사는 전부 프리미엄이라 같은 판정을 거친다.
// PDF 는 최대 ~10MB 라 함수 응답 한도(4.5MB)를 넘으므로 직접 흘려보내지 않고 Blob 주소로 넘긴다.
//   GET ?kind=problem|solution          → 302 Blob(브라우저 다운로드·앱 공유 시트용 fetch)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await viewerHasPremiumAccess())) {
    return NextResponse.json({ error: "프리미엄 이용권이 필요해요." }, { status: 403 });
  }
  const kind = request.nextUrl.searchParams.get("kind") === "solution" ? "solution" : "problem";
  const [exam, pdf] = await Promise.all([getMockExam(id), getMockExamPdf(id)]);
  if (!exam || !exam.isActive) {
    return NextResponse.json({ error: "모의고사를 찾을 수 없어요." }, { status: 404 });
  }
  const url = kind === "solution" ? pdf?.solutionUrl : pdf?.problemUrl;
  if (!url) {
    return NextResponse.json({ error: "이 모의고사는 PDF가 아직 없어요." }, { status: 404 });
  }
  const target = new URL(url);
  // Vercel Blob 은 download 쿼리로 Content-Disposition 을 붙여 준다.
  target.searchParams.set("download", "1");
  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
