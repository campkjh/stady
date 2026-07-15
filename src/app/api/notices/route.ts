import { NextResponse } from "next/server";
import { listSiteContent } from "@/lib/siteContent";

// 팝업 노출 여부/버전이 load-bearing이므로 CDN/브라우저 캐시로 stale되지 않게 한다.
export const dynamic = "force-dynamic";

// 공개: 노출 중인 공지사항 목록(정렬순). 홈의 새 공지 카드/진입 팝업에서 사용.
export async function GET() {
  try {
    const notices = await listSiteContent("notice", true);
    return NextResponse.json(
      { notices },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    console.error("Notices GET error:", error);
    return NextResponse.json({ notices: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
