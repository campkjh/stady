import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNicknameDuplicate, isNicknameTaken, validateNickname } from "@/lib/nickname";

export const dynamic = "force-dynamic";

// GET: 현재 닉네임과 "다른 사용자와 중복인지"(강제 변경 대상 여부). NicknameGate 가 사용.
export async function GET() {
  try {
    const user = await requireUser();
    const duplicate = await isNicknameDuplicate(user.id);
    return NextResponse.json({ nickname: user.nickname, duplicate });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      // 비로그인은 게이트를 띄우지 않는다.
      return NextResponse.json({ nickname: null, duplicate: false }, { status: 200 });
    }
    console.error("me/nickname GET error:", error);
    return NextResponse.json({ nickname: null, duplicate: false }, { status: 200 });
  }
}

// PUT { nickname }: 중복 없는 새 닉네임으로 변경. 이미 쓰는 이름이면 409.
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const v = validateNickname(body?.nickname);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    if (await isNicknameTaken(v.value, user.id)) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요." }, { status: 409 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { nickname: v.value } });
    return NextResponse.json({ nickname: v.value });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("me/nickname PUT error:", error);
    return NextResponse.json({ error: "닉네임 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
