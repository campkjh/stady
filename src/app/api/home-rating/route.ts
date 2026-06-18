import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// 홈에서 "앱 사용 3분 뒤" 별점 팝업을 계정당 딱 한 번만 띄우도록 게이트한다.
//  - 노출 타이밍(3분)은 클라이언트가 판정해 호출한다.
//  - "1회만"은 User.homeRatingPromptedAt 로 보장 → 기기 무관, 계정당 한 번.
//  - 퀴즈 리뷰(reviewPromptedAt)와는 독립이라 한 유저가 둘 다 받을 수 있다.

export async function POST() {
  try {
    const user = await requireUser();

    if (user.homeRatingPromptedAt) {
      return NextResponse.json({ prompt: false });
    }

    // 미노출 → 지금 노출로 표시(원자적 가드)하고 prompt:true 반환.
    const marked = await prisma.user.updateMany({
      where: { id: user.id, homeRatingPromptedAt: null },
      data: { homeRatingPromptedAt: new Date() },
    });

    return NextResponse.json({ prompt: marked.count > 0 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("home-rating POST error:", error);
    return NextResponse.json({ prompt: false }, { status: 500 });
  }
}
