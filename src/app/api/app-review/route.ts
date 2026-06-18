import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// 유저가 퀴즈를 일정 개수(THRESHOLD) 이상 풀었을 때, 계정당 딱 한 번만
// 앱스토어 리뷰 작성 팝업을 띄우도록 게이트하는 엔드포인트.
//  - 풀이 횟수는 QuizAttempt(OX·영단어·워크북 공통)로 계정 단위 집계.
//  - "1회만"은 User.reviewPromptedAt 로 보장 → 아이폰/아이패드 통틀어 한 번.
const THRESHOLD = 3;

export async function POST() {
  try {
    const user = await requireUser();

    // 이미 한 번 띄웠으면 다시는 안 띄움.
    if (user.reviewPromptedAt) {
      return NextResponse.json({ prompt: false });
    }

    const solved = await prisma.quizAttempt.count({ where: { userId: user.id } });
    if (solved < THRESHOLD) {
      return NextResponse.json({ prompt: false });
    }

    // 임계치 도달 + 미노출 → 지금 노출로 표시(원자적 가드)하고 prompt:true 반환.
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
