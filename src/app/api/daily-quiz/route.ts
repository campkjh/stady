import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  kstToday,
  getTodaysDailyQuestion,
  getMyDailyAnswer,
  getDailyStats,
  recordDailyAnswer,
} from "@/lib/daily-quiz";

// 오늘의 데일리 퀴즈 + (로그인 시) 내 응답/정답률.
export async function GET() {
  try {
    const { dateStr } = kstToday();
    const question = await getTodaysDailyQuestion();
    if (!question) {
      return NextResponse.json({ date: dateStr, question: null });
    }

    const user = await getCurrentUser();
    const mine = user ? await getMyDailyAnswer(user.id, dateStr) : null;
    const answered = !!mine;
    const stats = answered ? await getDailyStats(dateStr, question.id) : null;

    return NextResponse.json({
      date: dateStr,
      question: {
        id: question.id,
        text: question.question,
        categoryName: question.categoryName,
        title: `${question.categoryName} O/X`,
      },
      answered,
      mySelected: mine?.selected ?? null,
      // 정답은 응답한 경우에만 공개.
      correctAnswer: answered ? question.answer : null,
      myCorrect: mine?.isCorrect ?? null,
      stats,
    });
  } catch (error) {
    console.error("Daily quiz GET error:", error);
    return NextResponse.json({ error: "데일리 퀴즈를 불러오지 못했습니다." }, { status: 500 });
  }
}

// 오늘의 데일리 퀴즈 응답 제출(1일 1회). 정답 시 활동 경험치(티어)에 자동 반영.
// 비로그인 사용자도 정답/정답률은 볼 수 있으나 기록·경험치는 로그인 시에만.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.selected !== "boolean") {
      return NextResponse.json({ error: "선택 값이 올바르지 않습니다." }, { status: 400 });
    }
    const selected: boolean = body.selected;

    const { dateStr } = kstToday();
    const question = await getTodaysDailyQuestion();
    if (!question) {
      return NextResponse.json({ error: "오늘의 퀴즈가 없습니다." }, { status: 404 });
    }
    const isCorrect = selected === question.answer;

    const user = await getCurrentUser();
    if (!user) {
      // 게스트: 결과/통계만 제공(기록·경험치 없음).
      const stats = await getDailyStats(dateStr, question.id);
      return NextResponse.json({
        guest: true,
        mySelected: selected,
        isCorrect,
        correctAnswer: question.answer,
        xpGained: 0,
        stats,
      });
    }

    // 이미 응답했으면 기존 결과를 그대로 반환(중복 응답/중복 경험치 방지).
    const existing = await getMyDailyAnswer(user.id, dateStr);
    if (existing) {
      const stats = await getDailyStats(dateStr, question.id);
      return NextResponse.json({
        alreadyAnswered: true,
        mySelected: existing.selected,
        isCorrect: existing.isCorrect,
        correctAnswer: question.answer,
        xpGained: 0,
        stats,
      });
    }

    await recordDailyAnswer(user.id, dateStr, question.id, selected, isCorrect);
    const stats = await getDailyStats(dateStr, question.id);

    return NextResponse.json({
      mySelected: selected,
      isCorrect,
      correctAnswer: question.answer,
      xpGained: isCorrect ? 5 : 0,
      stats,
    });
  } catch (error) {
    console.error("Daily quiz POST error:", error);
    return NextResponse.json({ error: "응답 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
