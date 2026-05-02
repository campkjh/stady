import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import oxImportData from "../../../../scripts/ox-import-data.json";

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

async function ensureLifeEthicsOxData() {
  const data = oxImportData as OxImportData;
  const expectedQuestions = data.order.reduce((sum, title) => sum + (data.groups[title]?.length ?? 0), 0);
  if (expectedQuestions === 0) return;

  let category = await prisma.category.findFirst({ where: { name: "생활과윤리" } });
  if (!category) {
    category = await prisma.category.create({ data: { name: "생활과윤리" } });
  }

  const currentQuestions = await prisma.oxQuestion.count({
    where: { oxQuizSet: { categoryId: category.id } },
  });
  const currentSets = await prisma.oxQuizSet.findMany({
    where: { categoryId: category.id },
    select: { totalQuestions: true },
  });
  const currentListedQuestions = currentSets.reduce((sum, set) => sum + set.totalQuestions, 0);

  if (currentQuestions >= expectedQuestions && currentListedQuestions >= expectedQuestions) return;

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
            data: { difficulty: "보통", totalQuestions: questions.length },
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
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    await ensureLifeEthicsOxData();

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;

    const oxQuizSets = await prisma.oxQuizSet.findMany({
      where,
      include: {
        category: true,
        questions: {
          select: { section: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ oxQuizSets });
  } catch (error) {
    console.error("OX Quiz GET error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { title, thumbnail, categoryId, difficulty, totalQuestions } = body;

    if (!title || !categoryId) {
      return NextResponse.json(
        { error: "제목과 카테고리는 필수입니다." },
        { status: 400 }
      );
    }

    const oxQuizSet = await prisma.oxQuizSet.create({
      data: {
        title,
        thumbnail,
        categoryId,
        difficulty: difficulty || "보통",
        totalQuestions: totalQuestions || 0,
      },
      include: { category: true },
    });

    return NextResponse.json({ oxQuizSet }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
    }
    console.error("OX Quiz POST error:", error);
    return NextResponse.json(
      { error: "OX 퀴즈 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
