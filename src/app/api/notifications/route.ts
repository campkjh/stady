import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNotifications, listNotifications, markRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    return NextResponse.json(await listNotifications(user.id, user.createdAt));
  } catch (e) {
    console.error("notifications GET:", e);
    return NextResponse.json({ error: "알림을 불러오지 못했어요." }, { status: 500 });
  }
}

// { action: "read", ids } · { action: "read-all" } · { action: "delete", ids } · { action: "delete-all" }
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
    switch (body?.action) {
      case "read":
        await markRead(user.id, ids);
        break;
      case "read-all":
        await markRead(user.id, "all");
        break;
      case "delete":
        await deleteNotifications(user.id, ids);
        break;
      case "delete-all":
        await deleteNotifications(user.id, "all");
        break;
      default:
        return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("notifications POST:", e);
    return NextResponse.json({ error: "알림을 처리하지 못했어요." }, { status: 500 });
  }
}
