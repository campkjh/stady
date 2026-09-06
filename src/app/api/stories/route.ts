import { NextResponse } from "next/server";
import { listHighlights } from "@/lib/stories";

export const dynamic = "force-dynamic";

// 공개: 노출 중인 후기 하이라이트(슬라이드가 있는 것만).
export async function GET() {
  try {
    const highlights = (await listHighlights(true)).filter((h) => h.slides.length > 0);
    return NextResponse.json({ highlights }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("stories GET error:", error);
    return NextResponse.json({ highlights: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
