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

        await tx.oxAnswer.deleteMany({ where: { question: { oxQuizSetId: set.id } } });
        await tx.bookmark.deleteMany({ where: { oxQuizSetId: set.id } });
        await tx.quizAttempt.deleteMany({ where: { oxQuizSetId: set.id } });
        await tx.oxQuestion.deleteMany({ where: { oxQuizSetId: set.id } });

        await tx.oxQuestion.createMany({
          data: questions.map((q, index) => ({
            oxQuizSetId: set.id,
            order: index + 1,
            section: q.s || null,
            question: q.q,
            answer: q.a === "O",
            explanation: q.e || null,
          })),
        });
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
