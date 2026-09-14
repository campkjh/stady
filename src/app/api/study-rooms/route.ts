import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listStudyRooms, createStudyRoom } from "@/lib/studyRoom";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const me = await getCurrentUser();
    return NextResponse.json({ rooms: await listStudyRooms(me?.id ?? null) });
  } catch (error) {
    console.error("study rooms GET error:", error);
    return NextResponse.json({ rooms: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const name = String((body as { name?: unknown }).name ?? "").trim();
    if (!name) return NextResponse.json({ error: "방 이름을 입력해주세요." }, { status: 400 });
    const id = await createStudyRoom({
      ownerId: user.id,
      name,
      description: String((body as { description?: unknown }).description ?? "").trim() || null,
      icon: String((body as { icon?: unknown }).icon ?? "edu"),
      color: String((body as { color?: unknown }).color ?? "blue"),
      requireApproval: (body as { requireApproval?: unknown }).requireApproval === true,
      // 이미지는 우리 업로드(/api/community/uploads)가 돌려준 blob URL 만 받는다.
      imageUrl: (() => {
        const u = String((body as { imageUrl?: unknown }).imageUrl ?? "").trim();
        return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(u) ? u : null;
      })(),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("study rooms POST error:", error);
    return NextResponse.json({ error: "스타디룸을 만들지 못했습니다." }, { status: 500 });
  }
}
