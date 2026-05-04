import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getQuizProgress,
  upsertQuizProgress,
  deleteQuizProgress,
} from "@/lib/quiz-progress";

function unauthorized(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const quizKey = searchParams.get("quizKey");
    if (!quizKey) {
      return NextResponse.json({ error: "quizKey is required" }, { status: 400 });
    }
    const row = await getQuizProgress(user.id, quizKey);
    return NextResponse.json({ progress: row });
  } catch (error) {
    return unauthorized(error) ?? NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { quizKey, answersJson, currentIndex } = body;
    if (!quizKey || typeof answersJson !== "string") {
      return NextResponse.json({ error: "quizKey and answersJson are required" }, { status: 400 });
    }
    await upsertQuizProgress(user.id, quizKey, answersJson, Number(currentIndex) || 0);
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorized(error) ?? NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const quizKey = searchParams.get("quizKey");
    if (!quizKey) {
      return NextResponse.json({ error: "quizKey is required" }, { status: 400 });
    }
    await deleteQuizProgress(user.id, quizKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorized(error) ?? NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
