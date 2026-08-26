import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 프로필 사진 서빙 — User.avatar 는 base64 data URI(카톡)라 목록 payload 에 그대로
// 실으면 수 MB가 된다. 그래서 payload 엔 짧은 URL(/api/community/avatar/{id})만 싣고,
// 실제 이미지는 여기서 디코딩해 캐시와 함께 내려준다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await prisma.$queryRawUnsafe<{ avatar: string | null }[]>(
      `SELECT "avatar" FROM "User" WHERE "id" = $1 LIMIT 1`,
      id
    );
    const avatar = rows[0]?.avatar;
    if (!avatar) return new NextResponse(null, { status: 404 });

    // 이미 외부 URL 이면 그쪽으로 넘긴다(현재 데이터엔 없지만 향후 대비).
    if (/^https?:\/\//.test(avatar)) {
      return NextResponse.redirect(avatar, 302);
    }

    const match = avatar.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
    if (!match) return new NextResponse(null, { status: 404 });
    const contentType = match[1] || "image/jpeg";
    const isBase64 = !!match[2];
    const body = isBase64 ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 프로필은 자주 안 바뀐다 — 하루 캐시 + stale-while-revalidate.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Community avatar GET error:", error);
    return new NextResponse(null, { status: 500 });
  }
}
