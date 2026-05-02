import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import oxImportData from "../../../../../../scripts/ox-import-data.json";

export const runtime = "nodejs";

interface OxImportQuestion {
  q: string;
  a: "O" | "X";
  e?: string;
  s?: string | null;
}

interface OxImportData {
  order: string[];
  groups: Record<string, OxImportQuestion[]>;
}

export async function POST() {
  try {
    await requireAdmin();

    const data = oxImportData as OxImportData;
    const category = await prisma.category.findFirst({ where: { name: "생활과윤리" } });

    if (!category) {
      return NextResponse.json(
        { error: "생활과윤리 카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    let syncedSets = 0;
    let syncedQuestions = 0;

    for (const title of data.order) {
      const questions = data.groups[title] ?? [];
      if (questions.length === 0) continue;

      await prisma.$transaction(async (tx) => {
        const existing = await tx.oxQuizSet.findFirst({
          where: { title, categoryId: category.id },
          select: { id: true },
        });

        const set = existing
          ? await tx.oxQuizSet.update({
              where: { id: existing.id },
              data: {
                difficulty: "보통",
                totalQuestions: questions.length,
              },
              select: { id: true },
            })
          : await tx.oxQuizSet.create({
              data: {
                title,
                categoryId: category.id,
                difficulty: "보통",
                totalQuestions: questions.length,
              },
              select: { id: true },
            });

        const existingQuestions = await tx.oxQuestion.findMany({
          where: { oxQuizSetId: set.id },
          select: { id: true, order: true },
        });
        const questionByOrder = new Map(existingQuestions.map((question) => [question.order, question.id]));

        for (const [index, q] of questions.entries()) {
          const order = index + 1;
          const payload = {
            order,
            section: q.s || null,
            question: q.q,
            answer: q.a === "O",
            explanation: q.e || null,
          };
          const questionId = questionByOrder.get(order);
          if (questionId) {
            await tx.oxQuestion.update({ where: { id: questionId }, data: payload });
          } else {
            await tx.oxQuestion.create({ data: { oxQuizSetId: set.id, ...payload } });
          }
        }

        const extraQuestionIds = existingQuestions
          .filter((question) => question.order > questions.length)
          .map((question) => question.id);

        if (extraQuestionIds.length > 0) {
          await tx.oxAnswer.deleteMany({ where: { questionId: { in: extraQuestionIds } } });
          await tx.oxQuestion.deleteMany({ where: { id: { in: extraQuestionIds } } });
        }
      });

      syncedSets++;
      syncedQuestions += questions.length;
    }

    return NextResponse.json({
      success: true,
      syncedSets,
      syncedQuestions,
      expectedSets: data.order.length,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("OX sync error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈 동기화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
