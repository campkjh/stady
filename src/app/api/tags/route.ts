import { NextRequest, NextResponse } from "next/server";
import { getTags, mapTag } from "@/lib/community";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const tags = await getTags({ groupId, activeOnly: true });
    return NextResponse.json({ tags: tags.map(mapTag) });
  } catch (error) {
    console.error("Public tags API error:", error);
    return NextResponse.json({ error: "태그를 불러오지 못했습니다." }, { status: 500 });
  }
}
