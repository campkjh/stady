import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countUnread } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// 홈 머리줄 종 아이콘의 빨간 점용 — 가볍게 개수만.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ unread: 0 });
    return NextResponse.json({ unread: await countUnread(user.id) });
  } catch {
    return NextResponse.json({ unread: 0 });
  }
}
