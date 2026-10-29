import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCsatOxOrder } from "@/lib/csatPrep";
import { getLockedOxSetIds, getPremiumWorkbookIds } from "@/lib/premiumGate";

// 수능대비자료 목록 — 엘리트 모의고사(문제집) + 사상가별 파이널 선지(OX 세트, 단원 순서대로).
// 잠금 여부만 알려 준다. 실제 문제·정답은 각 풀이 API 가 프리미엄을 다시 확인한다.
export async function GET() {
  try {
    const [order, lockedOx, premiumWorkbooks, elite] = await Promise.all([
      getCsatOxOrder(),
      getLockedOxSetIds(),
      getPremiumWorkbookIds(),
      prisma.workbook.findFirst({
        where: { title: { contains: "엘리트" } },
        select: { id: true, title: true, totalQuestions: true, category: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const sets = order.size
      ? await prisma.oxQuizSet.findMany({
          where: { id: { in: [...order.keys()] } },
          select: {
            id: true,
            title: true,
            totalQuestions: true,
            questions: { select: { section: true }, orderBy: { order: "asc" } },
          },
        })
      : [];

    return NextResponse.json({
      elite: elite
        ? { id: elite.id, title: elite.title, subject: elite.category?.name ?? null, totalQuestions: elite.totalQuestions, isPremium: premiumWorkbooks.has(elite.id) }
        : null,
      sets: sets
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map((s) => ({
          id: s.id,
          title: s.title,
          totalQuestions: s.questions.length || s.totalQuestions,
          sections: Array.from(new Set(s.questions.map((q) => q.section).filter(Boolean))) as string[],
          isPremium: lockedOx.has(s.id),
        })),
    });
  } catch (error) {
    console.error("csat-prep GET error:", error);
    return NextResponse.json({ error: "수능대비자료를 불러오지 못했어요." }, { status: 500 });
  }
}
