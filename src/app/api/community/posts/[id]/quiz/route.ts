import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { answerCommunityQuiz } from "@/lib/community";

// OX 퀴즈 풀기 — 문제 하나에 O/X 한 번. 이미 푼 문제는 그대로 둔다(정답 보고 고치기 방지).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const questionId = String(body?.questionId || "");
    if (!questionId) {
      return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 400 });
    }
    if (typeof body?.answer !== "boolean") {
      return NextResponse.json({ error: "O 또는 X를 골라주세요." }, { status: 400 });
    }

    const quiz = await answerCommunityQuiz(id, user.id, questionId, body.answer);
    return NextResponse.json({ quiz });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CommunityPostNotFound") {
        return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
      }
      if (error.message === "CommunityQuizQuestionNotFound") {
        return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
      }
    }
    console.error("Community quiz POST error:", error);
    return NextResponse.json({ error: "퀴즈를 처리하지 못했습니다." }, { status: 500 });
  }
}
