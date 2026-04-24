import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { attemptId } = await request.json();

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId가 필요합니다." }, { status: 400 });
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId: user.id },
      include: {
        problemAnswers: {
          include: {
            problem: { select: { order: true, questionText: true, answer: true } },
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const answers = [...attempt.problemAnswers].sort(
      (a, b) => a.problem.order - b.problem.order
    );

    const total = answers.length;
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const wrongCount = total - correctCount;
    const correctRate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const totalDwell = answers.reduce((sum, a) => sum + (a.dwellSeconds || 0), 0);
    const avgDwell = total > 0 ? Math.round(totalDwell / total) : 0;

    // Longest dwell problem
    const sortedByDwell = [...answers].sort((a, b) => (b.dwellSeconds || 0) - (a.dwellSeconds || 0));
    const longest = sortedByDwell[0];

    // Quick/careless wrongs: wrong answers with very short dwell
    const quickWrongs = answers.filter((a) => !a.isCorrect && (a.dwellSeconds || 0) < Math.max(10, avgDwell / 3));

    // Wrong but long dwell (genuine difficulty)
    const struggledWrongs = answers.filter((a) => !a.isCorrect && (a.dwellSeconds || 0) >= avgDwell);

    // Build analysis text
    const sections: { title: string; body: string; tone: "good" | "warn" | "info" }[] = [];

    // Overall grade comment
    if (correctRate >= 90) {
      sections.push({
        title: "훌륭한 결과입니다!",
        body: `${total}문제 중 ${correctCount}문제를 맞혔어요. 정답률 ${correctRate}% — 안정적인 실력이 보여요. 오답 ${wrongCount}문제만 복습하면 완벽에 가까워집니다.`,
        tone: "good",
      });
    } else if (correctRate >= 70) {
      sections.push({
        title: "좋은 흐름이에요",
        body: `정답률 ${correctRate}%로 평균을 상회합니다. 실수로 놓친 문제만 줄이면 90% 이상으로 올릴 수 있어요.`,
        tone: "good",
      });
    } else if (correctRate >= 50) {
      sections.push({
        title: "개선 여지가 많습니다",
        body: `정답률 ${correctRate}%. 절반 이상은 맞았지만, 기본 개념에서 약한 부분이 보여요. 오답 ${wrongCount}문제를 복습하는 게 우선입니다.`,
        tone: "warn",
      });
    } else {
      sections.push({
        title: "기초 복습이 필요해요",
        body: `정답률 ${correctRate}%. 문제를 꾸준히 풀어 감을 잡는 것보다 먼저 개념 정리부터 해보세요.`,
        tone: "warn",
      });
    }

    // Time pacing
    if (avgDwell > 0) {
      if (avgDwell < 15) {
        sections.push({
          title: "속도가 빠른 편이에요",
          body: `문제당 평균 ${avgDwell}초만에 답을 골랐어요. 꼼꼼히 읽지 않고 감으로 고른 문항이 있을 수 있어요.`,
          tone: "warn",
        });
      } else if (avgDwell > 90) {
        sections.push({
          title: "신중하게 풀었어요",
          body: `문제당 평균 ${Math.round(avgDwell / 60 * 10) / 10}분 정도 고민했어요. 시간 배분을 조금 줄여도 정답률에 큰 영향은 없을 거예요.`,
          tone: "info",
        });
      } else {
        sections.push({
          title: "적절한 시간 배분",
          body: `문제당 평균 ${avgDwell}초 — 적당한 속도로 풀어냈습니다.`,
          tone: "info",
        });
      }
    }

    // Quick wrong pattern
    if (quickWrongs.length >= 2) {
      sections.push({
        title: "실수가 많아요",
        body: `${quickWrongs.map((a) => `${a.problem.order}번`).join(", ")} 문제는 ${quickWrongs[0].dwellSeconds}초 이하로 빠르게 고르고 틀렸어요. 문제를 끝까지 읽는 습관을 들여보세요.`,
        tone: "warn",
      });
    }

    // Struggled wrong pattern
    if (struggledWrongs.length >= 1) {
      sections.push({
        title: "다시 봐야 할 개념",
        body: `${struggledWrongs.map((a) => `${a.problem.order}번`).join(", ")} 문제는 오래 고민했지만 틀렸어요. 이 부분은 개념부터 다시 확인할 필요가 있어요.`,
        tone: "info",
      });
    }

    // Longest dwell
    if (longest && longest.dwellSeconds >= 30) {
      sections.push({
        title: `가장 오래 머문 문제: ${longest.problem.order}번`,
        body: `${longest.dwellSeconds}초 고민했어요 — ${longest.isCorrect ? "결국 맞혔으니 좋은 판단이었습니다." : "아쉽게 틀렸지만, 이런 유형을 반복 연습하면 속도가 붙을 거예요."}`,
        tone: "info",
      });
    }

    return NextResponse.json({
      stats: {
        total, correctCount, wrongCount, correctRate,
        totalDwellSeconds: totalDwell, avgDwellSeconds: avgDwell,
      },
      sections,
      problemDwells: answers.map((a) => ({
        order: a.problem.order,
        dwellSeconds: a.dwellSeconds,
        isCorrect: a.isCorrect,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
