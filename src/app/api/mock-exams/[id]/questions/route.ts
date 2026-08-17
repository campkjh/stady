import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listQuestions, getMyAnswers, saveAnswer } from "@/lib/mockExamQuestion";

export const dynamic = "force-dynamic";

// GET: 문항 목록(정답 없음) + 내가 지금까지 고른 답
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const [questions, myAnswers] = await Promise.all([
      listQuestions(id),
      user ? getMyAnswers(user.id, id) : Promise.resolve({}),
    ]);
    return NextResponse.json({ questions, myAnswers });
  } catch (error) {
    console.error("Mock exam questions GET error:", error);
    return NextResponse.json({ error: "문항을 불러오지 못했습니다." }, { status: 500 });
  }
}

// POST: 답 하나 저장. 고를 때마다 부르므로 가볍게 유지한다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const number = Number(body?.number);
    const selected = Number(body?.selected);
    if (!Number.isInteger(number) || number < 1 || number > 100) {
      return NextResponse.json({ error: "문항 번호가 올바르지 않습니다." }, { status: 400 });
    }
    // 객관식 1~5, 수학 단답형은 0~999.
    if (!Number.isInteger(selected) || selected < 0 || selected > 999) {
      return NextResponse.json({ error: "선택값이 올바르지 않습니다." }, { status: 400 });
    }
    await saveAnswer(user.id, id, number, selected);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mock exam answer POST error:", error);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
