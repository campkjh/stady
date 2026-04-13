import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

interface WordRow {
  word: string;
  correct: string;
  wrong1: string;
  wrong2: string;
  wrong3: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { words } = body as { words: WordRow[] };

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "단어 데이터가 없습니다." },
        { status: 400 }
      );
    }

    // 현재 마지막 order 확인
    const lastQuestion = await prisma.vocabQuestion.findFirst({
      where: { vocabQuizSetId: id },
      orderBy: { order: "desc" },
    });
    let orderStart = lastQuestion ? lastQuestion.order + 1 : 1;

    // 배치 삽입 (한 번에 최대 500개씩)
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE);
      const rows = batch.map((w, idx) => {
        // 정답 포함 4가지 선택지를 랜덤 순서로 배치
        const choices = shuffle([w.correct, w.wrong1, w.wrong2, w.wrong3]);
        const answerIndex = choices.indexOf(w.correct) + 1; // 1-based

        return {
          vocabQuizSetId: id,
          order: orderStart + idx,
          word: w.word.trim(),
          choice1: choices[0],
          choice2: choices[1],
          choice3: choices[2],
          choice4: choices[3],
          answer: answerIndex,
          explanation: null,
        };
      });

      await prisma.vocabQuestion.createMany({ data: rows });
      orderStart += batch.length;
      insertedCount += batch.length;
    }

    // totalQuestions 업데이트
    await prisma.vocabQuizSet.update({
      where: { id },
      data: { totalQuestions: { increment: insertedCount } },
    });

    return NextResponse.json({ inserted: insertedCount }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "일괄 가져오기 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
