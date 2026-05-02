import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WrongType = "workbook" | "ox" | "vocab";

type WrongStats = {
  attempts: number;
  wrongCount: number;
  wrongRate: number;
  avgSeconds: number;
};

function formatRate(wrong: number, total: number) {
  return total > 0 ? Math.round((wrong / total) * 100) : 0;
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "all") as WrongType | "all";

    const [problemWrongAnswers, oxWrongAnswers, vocabWrongAnswers] = await Promise.all([
      type === "all" || type === "workbook"
        ? prisma.problemAnswer.findMany({
            where: { isCorrect: false, attempt: { userId: user.id } },
            include: {
              attempt: { select: { completedAt: true } },
              problem: {
                include: {
                  workbook: { select: { id: true, title: true } },
                },
              },
            },
          })
        : [],
      type === "all" || type === "ox"
        ? prisma.oxAnswer.findMany({
            where: { isCorrect: false, attempt: { userId: user.id } },
            include: {
              attempt: { select: { completedAt: true, timeTaken: true, totalScore: true } },
              question: {
                include: {
                  oxQuizSet: {
                    select: {
                      id: true,
                      title: true,
                      category: { select: { name: true } },
                    },
                  },
                },
              },
            },
          })
        : [],
      type === "all" || type === "vocab"
        ? prisma.vocabAnswer.findMany({
            where: { isCorrect: false, attempt: { userId: user.id } },
            include: {
              attempt: { select: { completedAt: true, timeTaken: true, totalScore: true } },
              question: {
                include: {
                  vocabQuizSet: { select: { id: true, title: true } },
                },
              },
            },
          })
        : [],
    ]);

    const problemIds = [...new Set(problemWrongAnswers.map((answer) => answer.problemId))];
    const oxQuestionIds = [...new Set(oxWrongAnswers.map((answer) => answer.questionId))];
    const vocabQuestionIds = [...new Set(vocabWrongAnswers.map((answer) => answer.questionId))];

    const [problemAllAnswers, oxAllAnswers, vocabAllAnswers] = await Promise.all([
      problemIds.length
        ? prisma.problemAnswer.findMany({
            where: { problemId: { in: problemIds }, attempt: { userId: user.id } },
            select: { problemId: true, isCorrect: true, dwellSeconds: true },
          })
        : [],
      oxQuestionIds.length
        ? prisma.oxAnswer.findMany({
            where: { questionId: { in: oxQuestionIds }, attempt: { userId: user.id } },
            include: { attempt: { select: { timeTaken: true, totalScore: true } } },
          })
        : [],
      vocabQuestionIds.length
        ? prisma.vocabAnswer.findMany({
            where: { questionId: { in: vocabQuestionIds }, attempt: { userId: user.id } },
            include: { attempt: { select: { timeTaken: true, totalScore: true } } },
          })
        : [],
    ]);

    const problemStats = new Map<string, WrongStats>(problemIds.map((id) => {
      const answers = problemAllAnswers.filter((answer) => answer.problemId === id);
      const wrongCount = answers.filter((answer) => !answer.isCorrect).length;
      return [id, {
        attempts: answers.length,
        wrongCount,
        wrongRate: formatRate(wrongCount, answers.length),
        avgSeconds: avg(answers.map((answer) => answer.dwellSeconds || 0).filter((value) => value > 0)),
      }] as const;
    }));

    const oxStats = new Map<string, WrongStats>(oxQuestionIds.map((id) => {
      const answers = oxAllAnswers.filter((answer) => answer.questionId === id);
      const wrongCount = answers.filter((answer) => !answer.isCorrect).length;
      return [id, {
        attempts: answers.length,
        wrongCount,
        wrongRate: formatRate(wrongCount, answers.length),
        avgSeconds: avg(answers.map((answer) => answer.attempt.totalScore > 0 ? Math.round(answer.attempt.timeTaken / answer.attempt.totalScore) : 0).filter((value) => value > 0)),
      }] as const;
    }));

    const vocabStats = new Map<string, WrongStats>(vocabQuestionIds.map((id) => {
      const answers = vocabAllAnswers.filter((answer) => answer.questionId === id);
      const wrongCount = answers.filter((answer) => !answer.isCorrect).length;
      return [id, {
        attempts: answers.length,
        wrongCount,
        wrongRate: formatRate(wrongCount, answers.length),
        avgSeconds: avg(answers.map((answer) => answer.attempt.totalScore > 0 ? Math.round(answer.attempt.timeTaken / answer.attempt.totalScore) : 0).filter((value) => value > 0)),
      }] as const;
    }));

    const problemSeen = new Set<string>();
    const workbookItems = problemWrongAnswers.flatMap((answer) => {
      if (problemSeen.has(answer.problemId)) return [];
      problemSeen.add(answer.problemId);
      const stats = problemStats.get(answer.problemId);
      return [{
        id: answer.problemId,
        type: "workbook",
        title: answer.problem.workbook.title,
        subtitle: `문제 ${answer.problem.order}`,
        prompt: answer.problem.questionText || "이미지 문제",
        selected: answer.selected,
        answer: answer.problem.answer,
        explanation: answer.problem.explanation,
        questionImage: answer.problem.questionImage,
        passageImage: answer.problem.passageImage,
        choices: [
          answer.problem.choice1,
          answer.problem.choice2,
          answer.problem.choice3,
          answer.problem.choice4,
          answer.problem.choice5,
        ].filter(Boolean),
        stats,
        lastWrongAt: answer.attempt.completedAt,
      }];
    });

    const oxSeen = new Set<string>();
    const oxItems = oxWrongAnswers.flatMap((answer) => {
      if (oxSeen.has(answer.questionId)) return [];
      oxSeen.add(answer.questionId);
      const stats = oxStats.get(answer.questionId);
      const category = answer.question.oxQuizSet.category?.name;
      return [{
        id: answer.questionId,
        type: "ox",
        title: [category, answer.question.oxQuizSet.title, answer.question.section].filter(Boolean).join(" > "),
        subtitle: `문제 ${answer.question.order}`,
        prompt: answer.question.question,
        selected: answer.selected,
        answer: answer.question.answer,
        explanation: answer.question.explanation,
        stats,
        lastWrongAt: answer.attempt.completedAt,
      }];
    });

    const vocabSeen = new Set<string>();
    const vocabItems = vocabWrongAnswers.flatMap((answer) => {
      if (vocabSeen.has(answer.questionId)) return [];
      vocabSeen.add(answer.questionId);
      const question = answer.question;
      const choices = [question.choice1, question.choice2, question.choice3, question.choice4];
      const stats = vocabStats.get(answer.questionId);
      return [{
        id: answer.questionId,
        type: "vocab",
        title: question.vocabQuizSet.title,
        subtitle: question.word,
        prompt: `"${question.word}"의 뜻`,
        selected: answer.selected,
        answer: question.answer,
        answerText: choices[question.answer - 1],
        explanation: question.explanation,
        choices,
        stats,
        lastWrongAt: answer.attempt.completedAt,
      }];
    });

    const items = [...workbookItems, ...oxItems, ...vocabItems].sort(
      (a, b) => new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime()
    );

    const totals = {
      all: items.length,
      workbook: workbookItems.length,
      ox: oxItems.length,
      vocab: vocabItems.length,
      avgWrongRate: items.length ? Math.round(items.reduce((sum, item) => sum + (item.stats?.wrongRate || 0), 0) / items.length) : 0,
      avgSeconds: items.length ? avg(items.map((item) => item.stats?.avgSeconds || 0).filter((value) => value > 0)) : 0,
    };

    return NextResponse.json({ items, totals });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Wrong note error:", error);
    return NextResponse.json(
      { error: "오답노트를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
