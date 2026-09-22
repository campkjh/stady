import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 커뮤니티 글쓰기에서 '문제 오류'를 건의할 때 붙일 문제를 고르는 목록.
//  · 검색어가 있으면 문제 문장으로 찾는다.
//  · 없으면 내가 최근에 푼 문제를 먼저 보여준다(방금 이상하다고 느낀 문제일 확률이 높다).
// 문제 본문만 내려보내고 정답은 함께 싣는다 — 어차피 푼 뒤 건의하는 흐름이고,
// 글에도 "표시된 정답"으로 적히는 값이다.

interface Row {
  id: string;
  question: string;
  answer: boolean;
  set_id: string;
  set_title: string;
}

export async function GET(request: NextRequest) {
  try {
    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    const user = await getCurrentUser();

    let rows: Row[] = [];
    if (q) {
      rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT x."id", x."question", x."answer", s."id" AS set_id, s."title" AS set_title
         FROM "OxQuestion" x
         JOIN "OxQuizSet" s ON s."id" = x."oxQuizSetId"
         WHERE x."question" ILIKE $1
         ORDER BY s."title" ASC, x."order" ASC
         LIMIT 30`,
        `%${q}%`
      );
    } else if (user) {
      rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT DISTINCT ON (x."id") x."id", x."question", x."answer",
                s."id" AS set_id, s."title" AS set_title, a."completedAt"
         FROM "OxAnswer" o
         JOIN "QuizAttempt" a ON a."id" = o."attemptId"
         JOIN "OxQuestion" x ON x."id" = o."questionId"
         JOIN "OxQuizSet" s ON s."id" = x."oxQuizSetId"
         WHERE a."userId" = $1
         ORDER BY x."id", a."completedAt" DESC
         LIMIT 30`,
        user.id
      );
    }

    return NextResponse.json({
      questions: rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        setId: r.set_id,
        setTitle: r.set_title,
      })),
    });
  } catch (error) {
    console.error("OX question pick API error:", error);
    return NextResponse.json({ error: "문제를 불러오지 못했습니다." }, { status: 500 });
  }
}
