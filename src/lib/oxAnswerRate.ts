import { prisma } from "@/lib/prisma";

// 문항별 정답률(%)을 사용자 응답에서 자동 집계한다.
// 분모 = 실제로 답한(selected != null) 응답 수, 분자 = 정답(isCorrect) 수.
// 표본이 MIN_SAMPLES 미만인 문항은 맵에 넣지 않는다(노이즈 방지 → 배지 미표시).
const MIN_SAMPLES = 1;

export async function computeAnswerRates(questionIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (questionIds.length === 0) return map;

  const [totals, corrects] = await Promise.all([
    prisma.oxAnswer.groupBy({
      by: ["questionId"],
      where: { questionId: { in: questionIds }, selected: { not: null } },
      _count: { _all: true },
    }),
    prisma.oxAnswer.groupBy({
      by: ["questionId"],
      where: { questionId: { in: questionIds }, selected: { not: null }, isCorrect: true },
      _count: { _all: true },
    }),
  ]);

  const correctByQ = new Map<string, number>();
  for (const c of corrects) correctByQ.set(c.questionId, c._count._all);

  for (const t of totals) {
    const total = t._count._all;
    if (total < MIN_SAMPLES) continue;
    const correct = correctByQ.get(t.questionId) ?? 0;
    map.set(t.questionId, Math.round((correct / total) * 100));
  }
  return map;
}
