import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const quizType = searchParams.get("quizType");

    const where: Record<string, unknown> = { userId: user.id };
    if (quizType) where.quizType = quizType;

    const bookmarks = await prisma.bookmark.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Enrich bookmarks with related data for display
    const enriched = await Promise.all(
      bookmarks.map(async (bm) => {
        let title = "";
        let subtitle = "";
        let word: string | null = null;
        let meaning: string | null = null;

        if (bm.quizType === "workbook" && bm.workbookId) {
          const wb = await prisma.workbook.findUnique({ where: { id: bm.workbookId } });
          title = wb?.title || "";
          if (bm.problemId) {
            const prob = await prisma.problem.findUnique({ where: { id: bm.problemId } });
            subtitle = prob?.questionText || "";
          } else {
            subtitle = `${wb?.totalQuestions || 0}문항`;
          }
        } else if (bm.quizType === "ox" && bm.oxQuizSetId) {
          const oxSet = await prisma.oxQuizSet.findUnique({ where: { id: bm.oxQuizSetId } });
          title = oxSet?.title || "";
          if (bm.oxQuestionId) {
            const q = await prisma.oxQuestion.findUnique({ where: { id: bm.oxQuestionId } });
            subtitle = q?.question || "";
          }
        } else if (bm.quizType === "vocab" && bm.vocabQuizSetId) {
          const vSet = await prisma.vocabQuizSet.findUnique({ where: { id: bm.vocabQuizSetId } });
          title = vSet?.title || "";
          if (bm.vocabQuestionId) {
            const q = await prisma.vocabQuestion.findUnique({ where: { id: bm.vocabQuestionId } });
            if (q) {
              word = q.word;
              const choices = [q.choice1, q.choice2, q.choice3, q.choice4];
              meaning = choices[q.answer - 1] || null;
              subtitle = q.word;
            }
          }
        }

        return { ...bm, title, subtitle, word, meaning };
      })
    );

    return NextResponse.json({ bookmarks: enriched });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Bookmarks GET error:", error);
    return NextResponse.json(
      { error: "북마크를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const {
      quizType,
      problemId,
      oxQuestionId,
      vocabQuestionId,
      workbookId,
      oxQuizSetId,
      vocabQuizSetId,
    } = body;

    if (!quizType) {
      return NextResponse.json(
        { error: "퀴즈 타입은 필수입니다." },
        { status: 400 }
      );
    }

    // Build the unique filter to find existing bookmark
    const findWhere: Record<string, unknown> = {
      userId: user.id,
      quizType,
    };

    if (quizType === "workbook" && problemId) {
      findWhere.problemId = problemId;
    } else if (quizType === "ox" && oxQuestionId) {
      findWhere.oxQuestionId = oxQuestionId;
    } else if (quizType === "vocab" && vocabQuestionId) {
      findWhere.vocabQuestionId = vocabQuestionId;
    }

    // Toggle: if exists, remove; otherwise create
    const existing = await prisma.bookmark.findFirst({ where: findWhere });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false, message: "북마크가 해제되었습니다." });
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        userId: user.id,
        quizType,
        workbookId: workbookId || null,
        oxQuizSetId: oxQuizSetId || null,
        vocabQuizSetId: vocabQuizSetId || null,
        problemId: problemId || null,
        oxQuestionId: oxQuestionId || null,
        vocabQuestionId: vocabQuestionId || null,
      },
    });

    return NextResponse.json({ bookmarked: true, bookmark });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Bookmarks POST error:", error);
    return NextResponse.json(
      { error: "북마크 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "북마크 ID는 필수입니다." },
        { status: 400 }
      );
    }

    await prisma.bookmark.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Bookmarks DELETE error:", error);
    return NextResponse.json(
      { error: "북마크 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
