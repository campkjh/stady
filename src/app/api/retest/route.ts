import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the user's collected questions (wrong answers OR bookmarks) as a flat,
// normalized list so they can be re-tested all at once on /retest. This is a
// read-only practice feed — taking the retest does NOT create a QuizAttempt, so
// it never pollutes history/stats or re-triggers auto-bookmarking.

type RetestType = "all" | "workbook" | "ox" | "vocab";

interface RetestItem {
  id: string;
  type: "workbook" | "ox" | "vocab";
  title: string;
  subtitle: string;
  prompt: string;
  answer: number | boolean;
  answerText?: string;
  explanation?: string | null;
  questionImage?: string | null;
  passageImage?: string | null;
  choices?: string[];
  section?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") === "bookmark" ? "bookmark" : "wrong";
    const type = (searchParams.get("type") || "all") as RetestType;

    const wantWorkbook = type === "all" || type === "workbook";
    const wantOx = type === "all" || type === "ox";
    const wantVocab = type === "all" || type === "vocab";

    const items: RetestItem[] =
      source === "bookmark"
        ? await collectBookmarks(user.id, { wantWorkbook, wantOx, wantVocab })
        : await collectWrong(user.id, { wantWorkbook, wantOx, wantVocab });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Retest feed error:", error);
    return NextResponse.json({ error: "문제를 가져오는 중 오류가 발생했습니다." }, { status: 500 });
  }
}

type Flags = { wantWorkbook: boolean; wantOx: boolean; wantVocab: boolean };

async function collectWrong(userId: string, { wantWorkbook, wantOx, wantVocab }: Flags): Promise<RetestItem[]> {
  const [problemAnswers, oxAnswers, vocabAnswers] = await Promise.all([
    wantWorkbook
      ? prisma.problemAnswer.findMany({
          where: { isCorrect: false, attempt: { userId } },
          orderBy: { attempt: { completedAt: "desc" } },
          include: { problem: { include: { workbook: { select: { title: true } } } } },
        })
      : [],
    wantOx
      ? prisma.oxAnswer.findMany({
          where: { isCorrect: false, attempt: { userId } },
          orderBy: { attempt: { completedAt: "desc" } },
          include: { question: { include: { oxQuizSet: { select: { title: true, category: { select: { name: true } } } } } } },
        })
      : [],
    wantVocab
      ? prisma.vocabAnswer.findMany({
          where: { isCorrect: false, attempt: { userId } },
          orderBy: { attempt: { completedAt: "desc" } },
          include: { question: { include: { vocabQuizSet: { select: { title: true } } } } },
        })
      : [],
  ]);

  const seen = new Set<string>();
  const items: RetestItem[] = [];

  for (const a of problemAnswers) {
    if (seen.has(`w:${a.problemId}`)) continue;
    seen.add(`w:${a.problemId}`);
    items.push(normalizeProblem(a.problem));
  }
  for (const a of oxAnswers) {
    if (seen.has(`o:${a.questionId}`)) continue;
    seen.add(`o:${a.questionId}`);
    items.push(normalizeOx(a.question));
  }
  for (const a of vocabAnswers) {
    if (seen.has(`v:${a.questionId}`)) continue;
    seen.add(`v:${a.questionId}`);
    items.push(normalizeVocab(a.question));
  }
  return items;
}

async function collectBookmarks(userId: string, { wantWorkbook, wantOx, wantVocab }: Flags): Promise<RetestItem[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { quizType: true, problemId: true, oxQuestionId: true, vocabQuestionId: true },
  });

  const problemIds: string[] = [];
  const oxIds: string[] = [];
  const vocabIds: string[] = [];
  const seen = new Set<string>();
  for (const bm of bookmarks) {
    if (wantWorkbook && bm.quizType === "workbook" && bm.problemId && !seen.has(`w:${bm.problemId}`)) {
      seen.add(`w:${bm.problemId}`);
      problemIds.push(bm.problemId);
    } else if (wantOx && bm.quizType === "ox" && bm.oxQuestionId && !seen.has(`o:${bm.oxQuestionId}`)) {
      seen.add(`o:${bm.oxQuestionId}`);
      oxIds.push(bm.oxQuestionId);
    } else if (wantVocab && bm.quizType === "vocab" && bm.vocabQuestionId && !seen.has(`v:${bm.vocabQuestionId}`)) {
      seen.add(`v:${bm.vocabQuestionId}`);
      vocabIds.push(bm.vocabQuestionId);
    }
  }

  const [problems, oxQuestions, vocabQuestions] = await Promise.all([
    problemIds.length
      ? prisma.problem.findMany({ where: { id: { in: problemIds } }, include: { workbook: { select: { title: true } } } })
      : [],
    oxIds.length
      ? prisma.oxQuestion.findMany({ where: { id: { in: oxIds } }, include: { oxQuizSet: { select: { title: true, category: { select: { name: true } } } } } })
      : [],
    vocabIds.length
      ? prisma.vocabQuestion.findMany({ where: { id: { in: vocabIds } }, include: { vocabQuizSet: { select: { title: true } } } })
      : [],
  ]);

  // Preserve the most-recent-bookmark-first order captured above.
  const problemMap = new Map(problems.map((p) => [p.id, p]));
  const oxMap = new Map(oxQuestions.map((q) => [q.id, q]));
  const vocabMap = new Map(vocabQuestions.map((q) => [q.id, q]));

  const items: RetestItem[] = [];
  for (const id of problemIds) {
    const p = problemMap.get(id);
    if (p) items.push(normalizeProblem(p));
  }
  for (const id of oxIds) {
    const q = oxMap.get(id);
    if (q) items.push(normalizeOx(q));
  }
  for (const id of vocabIds) {
    const q = vocabMap.get(id);
    if (q) items.push(normalizeVocab(q));
  }
  return items;
}

type ProblemRow = {
  id: string; order: number; questionText: string | null; answer: number; explanation: string | null;
  questionImage: string | null; passageImage: string | null;
  choice1: string; choice2: string; choice3: string; choice4: string; choice5: string | null;
  workbook: { title: string };
};
function normalizeProblem(p: ProblemRow): RetestItem {
  return {
    id: p.id,
    type: "workbook",
    title: p.workbook.title,
    subtitle: `문제 ${p.order}`,
    prompt: p.questionText || "이미지 문제",
    answer: p.answer,
    explanation: p.explanation,
    questionImage: p.questionImage,
    passageImage: p.passageImage,
    choices: [p.choice1, p.choice2, p.choice3, p.choice4, p.choice5].filter(Boolean) as string[],
  };
}

type OxRow = {
  id: string; order: number; section: string | null; question: string; answer: boolean; explanation: string | null;
  oxQuizSet: { title: string; category: { name: string } | null };
};
function normalizeOx(q: OxRow): RetestItem {
  return {
    id: q.id,
    type: "ox",
    title: [q.oxQuizSet.category?.name, q.oxQuizSet.title].filter(Boolean).join(" > "),
    subtitle: q.section || `문제 ${q.order}`,
    prompt: q.question,
    answer: q.answer,
    explanation: q.explanation,
    section: q.section,
  };
}

type VocabRow = {
  id: string; word: string; answer: number; explanation: string | null;
  choice1: string; choice2: string; choice3: string; choice4: string;
  vocabQuizSet: { title: string };
};
function normalizeVocab(q: VocabRow): RetestItem {
  const choices = [q.choice1, q.choice2, q.choice3, q.choice4];
  return {
    id: q.id,
    type: "vocab",
    title: q.vocabQuizSet.title,
    subtitle: q.word,
    prompt: `"${q.word}"의 뜻으로 알맞은 것은?`,
    answer: q.answer,
    answerText: choices[q.answer - 1],
    explanation: q.explanation,
    choices,
  };
}
