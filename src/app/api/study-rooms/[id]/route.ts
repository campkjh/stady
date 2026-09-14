import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStudyRoom, joinStudyRoom, leaveStudyRoom, closeStudyRoom } from "@/lib/studyRoom";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    const room = await getStudyRoom(id, me?.id ?? null);
    if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ room });
  } catch (error) {
    console.error("study room GET error:", error);
    return NextResponse.json({ error: "방 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

// action: join | leave | close(방장만)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String((body as { action?: unknown }).action ?? "join");
    if (action === "leave") await leaveStudyRoom(id, user.id);
    else if (action === "close") {
      const ok = await closeStudyRoom(id, user.id);
      if (!ok) return NextResponse.json({ error: "방장만 닫을 수 있습니다." }, { status: 403 });
    } else await joinStudyRoom(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("study room POST error:", error);
    return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  }
}
