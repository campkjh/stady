import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

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

    return NextResponse.json({ questions });
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
    const { question, answer, explanation, section, order: requestedOrder } = body;

    if (!question || answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "질문과 정답은 필수입니다." },
        { status: 400 }
      );
    }

    // 원하는 번호 위치에 삽입한다. 범위 안(1..현재개수)이면 그 위치에 넣고 뒤
    // 문제들의 order 를 한 칸씩 민다. 미지정이거나 범위 밖이면 맨 끝에 추가.
    const oxQuestion = await prisma.$transaction(async (tx) => {
      const count = await tx.oxQuestion.count({ where: { oxQuizSetId: id } });
      const reqPos = Number(requestedOrder);
      let order: number;
      if (Number.isFinite(reqPos) && reqPos >= 1 && reqPos <= count) {
        order = Math.floor(reqPos);
        await tx.oxQuestion.updateMany({
          where: { oxQuizSetId: id, order: { gte: order } },
          data: { order: { increment: 1 } },
        });
      } else {
        const last = await tx.oxQuestion.findFirst({
          where: { oxQuizSetId: id },
          orderBy: { order: "desc" },
        });
        order = last ? last.order + 1 : 1;
      }

      const created = await tx.oxQuestion.create({
        data: {
          oxQuizSetId: id,
          order,
          section: section || null,
          question,
          answer: Boolean(answer),
          explanation: explanation || null,
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
