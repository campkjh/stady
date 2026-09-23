import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { QUIZ_MAX_POSTS_PER_DAY, QUIZ_MAX_QUESTIONS_PER_POST, remainingQuizPostsToday } from "@/lib/community";

// 오늘 OX 퀴즈를 몇 개 더 올릴 수 있는지. 글쓰기 화면에서 'OX퀴즈'를 켤 때 물어본다
// (5문제 다 쓰고 나서야 상한에 걸리는 일이 없게).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const remaining = await remainingQuizPostsToday(user.id);
    return NextResponse.json({
      remaining,
      maxPerDay: QUIZ_MAX_POSTS_PER_DAY,
      maxQuestions: QUIZ_MAX_QUESTIONS_PER_POST,
    });
  } catch (error) {
    console.error("Community quiz quota error:", error);
    // 조회에 실패했다고 글쓰기를 막지는 않는다 — 진짜 상한은 저장할 때 서버가 잡는다.
    return NextResponse.json({ remaining: QUIZ_MAX_POSTS_PER_DAY, maxPerDay: QUIZ_MAX_POSTS_PER_DAY, maxQuestions: QUIZ_MAX_QUESTIONS_PER_POST });
  }
}
