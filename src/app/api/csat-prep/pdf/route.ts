import { NextRequest, NextResponse } from "next/server";
import { CSAT_PDF_KEYS, getCsatPdfs } from "@/lib/csatPrep";
import { viewerHasPremiumAccess } from "@/lib/premiumGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 수능대비자료 카드 원본 PDF 받기 — 모의고사 PDF(/api/mock-exams/[id]/pdf)와 같은 방식.
//   GET ?key=elite|<묶음>&kind=problem|solution → 302 Blob(함수 응답 한도 4.5MB 를 넘는 파일이 있어 직접 흘리지 않는다)
export async function GET(request: NextRequest) {
  if (!(await viewerHasPremiumAccess())) {
    return NextResponse.json({ error: "프리미엄 이용권이 필요해요." }, { status: 403 });
  }
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") === "solution" ? "solution" : "problem";
  if (!CSAT_PDF_KEYS.includes(key)) {
    return NextResponse.json({ error: "자료를 찾을 수 없어요." }, { status: 404 });
  }
  const pdf = (await getCsatPdfs()).get(key);
  const url = kind === "solution" ? pdf?.solutionUrl : pdf?.problemUrl;
  if (!url) {
    return NextResponse.json({ error: "이 자료는 PDF가 아직 없어요." }, { status: 404 });
  }
  const target = new URL(url);
  target.searchParams.set("download", "1");
  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
