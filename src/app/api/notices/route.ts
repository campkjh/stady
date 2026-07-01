import { NextResponse } from "next/server";
import { listSiteContent } from "@/lib/siteContent";

// 공개: 노출 중인 공지사항 목록(정렬순). 홈의 새 공지 카드 등에서 사용.
export async function GET() {
  try {
    const notices = await listSiteContent("notice", true);
    return NextResponse.json({ notices });
  } catch (error) {
    console.error("Notices GET error:", error);
    return NextResponse.json({ notices: [] });
  }
}
