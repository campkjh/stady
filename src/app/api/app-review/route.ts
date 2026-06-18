import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// 앱스토어 리뷰 작성 팝업을 계정당 딱 한 번만 띄우도록 게이트하는 엔드포인트.
//  - 노출 조건(한 판에서 3번째 문제를 푼 시점)은 클라이언트(퀴즈 페이지)가 판정해
//    이 엔드포인트를 호출한다. 서버는 "계정당 1회"만 보장한다.
//  - "1회만"은 User.reviewPromptedAt 로 보장 → 아이폰/아이패드 통틀어 한 번.

export async function POST() {
  try {
    const user = await requireUser();

    // 이미 한 번 띄웠으면 다시는 안 띄움.
    if (user.reviewPromptedAt) {
      return NextResponse.json({ prompt: false });
    }

    // 미노출 → 지금 노출로 표시(원자적 가드)하고 prompt:true 반환.
    // 동시 요청이 와도 reviewPromptedAt 가 null 인 행만 업데이트되므로 중복 노출 방지.
    const marked = await prisma.user.updateMany({
      where: { id: user.id, reviewPromptedAt: null },
      data: { reviewPromptedAt: new Date() },
    });

    return NextResponse.json({ prompt: marked.count > 0 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("app-review POST error:", error);
    return NextResponse.json({ prompt: false }, { status: 500 });
  }
}
