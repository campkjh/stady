import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeAnswerRates } from "@/lib/oxAnswerRate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const questions = await prisma.oxQuestion.findMany({
      where: { oxQuizSetId: id },
      orderBy: { order: "asc" },
    });

    // 정답률은 사용자 응답에서 실시간 집계(어드민은 읽기 전용으로 확인).
    const rates = await computeAnswerRates(questions.map((q) => q.id));
    const withRates = questions.map((q) => ({ ...q, answerRate: rates.get(q.id) ?? null }));

    return NextResponse.json({ questions: withRates });
  } catch (error) {
    console.error("OX Questions GET error:", error);
    return NextResponse.json(
      { error: "질문을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    // position = "선택한 소분류 내부"의 1-based 위치(없으면 그 소분류 맨 끝).
    // 과거엔 order(세트 전체 글로벌 위치)를 받아 소분류가 쪼개지는 버그가 있었음.
    const { question, answer, explanation, section, examYearMonth, position: requestedPosition } = body;

    if (!question || answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "질문과 정답은 필수입니다." },
        { status: 400 }
      );
    }

    const sec: string | null = section || null;
    const examYM: string | null = examYearMonth ? String(examYearMonth).trim() || null : null;

    // 새 문제를 "같은 소분류 블록 안"에 끼워넣어 소분류가 쪼개지지(=새 소분류처럼 보이지)
    // 않도록 한다. position 은 그 소분류 내부 위치(1..해당소분류개수+1).
    const oxQuestion = await prisma.$transaction(async (tx) => {
      const sectionQs = await tx.oxQuestion.findMany({
        where: { oxQuizSetId: id, section: sec },
        orderBy: { order: "asc" },
        select: { order: true },
      });

      let order: number;
      if (sectionQs.length === 0) {
        // 해당 소분류에 문제가 없으면(새 소분류 포함) 세트 맨 끝에 추가 — 쪼갤 일이 없다.
        const last = await tx.oxQuestion.findFirst({
          where: { oxQuizSetId: id },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        order = last ? last.order + 1 : 1;
      } else {
        const reqPos = Number(requestedPosition);
        const pos = Number.isFinite(reqPos)
          ? Math.min(Math.max(Math.floor(reqPos), 1), sectionQs.length + 1)
          : sectionQs.length + 1;
        // 소분류 내부 pos 위치의 글로벌 order. 끝이면 그 소분류 마지막 문제 바로 뒤.
        order = pos <= sectionQs.length ? sectionQs[pos - 1].order : sectionQs[sectionQs.length - 1].order + 1;
        await tx.oxQuestion.updateMany({
          where: { oxQuizSetId: id, order: { gte: order } },
          data: { order: { increment: 1 } },
        });
      }

      const created = await tx.oxQuestion.create({
        data: {
          oxQuizSetId: id,
          order,
          section: sec,
          question,
          answer: Boolean(answer),
          explanation: explanation || null,
          examYearMonth: examYM,
        },
      });

      await tx.oxQuizSet.update({
        where: { id },
        data: { totalQuestions: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json({ question: oxQuestion }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("OX Questions POST error:", error);
    return NextResponse.json(
      { error: "질문 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
