import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 로그인 사용자가 OX 세트별로 답한 (중복 제거) 문항 수를 반환한다.
// 홈 카드의 진척도 막대(답한 문항 / 총 문항)에 사용.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ progress: {} });

    const rows = await prisma.$queryRawUnsafe<{ set_id: string; answered: bigint }[]>(
      `
        SELECT q."oxQuizSetId" AS set_id, COUNT(DISTINCT oa."questionId") AS answered
        FROM "OxAnswer" oa
        JOIN "OxQuestion" q ON q."id" = oa."questionId"
        JOIN "QuizAttempt" t ON t."id" = oa."attemptId"
        WHERE t."userId" = $1
        GROUP BY q."oxQuizSetId"
      `,
      user.id
    );

    const progress: Record<string, number> = {};
    for (const r of rows) progress[r.set_id] = Number(r.answered);
    return NextResponse.json({ progress });
  } catch {
    return NextResponse.json({ progress: {} });
  }
}
