import { NextResponse } from "next/server";
import { getCategoryGroups, mapGroup } from "@/lib/community";

export async function GET() {
  try {
    const groups = await getCategoryGroups({ activeOnly: true });
    return NextResponse.json({ groups: groups.map(mapGroup) });
  } catch (error) {
    console.error("Public category groups API error:", error);
    return NextResponse.json({ error: "카테고리를 불러오지 못했습니다." }, { status: 500 });
  }
}
