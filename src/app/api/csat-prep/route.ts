import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CSAT_GROUPS, getCsatOxGroups } from "@/lib/csatPrep";
import { getLockedOxSetIds, getPremiumWorkbookIds } from "@/lib/premiumGate";

// 수능대비자료 목록 — 엘리트 모의고사(문제집) + OX 묶음들(생윤 파이널 선지·윤사 고난도 선지, 묶음별 단원 순서).
// 잠금 여부만 알려 준다. 실제 문제·정답은 각 풀이 API 가 프리미엄을 다시 확인한다.
export async function GET() {
  try {
    const [groupOf, lockedOx, premiumWorkbooks, elite] = await Promise.all([
      getCsatOxGroups(),
      getLockedOxSetIds(),
      getPremiumWorkbookIds(),
      prisma.workbook.findFirst({
        where: { title: { contains: "엘리트" } },
        select: { id: true, title: true, totalQuestions: true, category: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const sets = groupOf.size
      ? await prisma.oxQuizSet.findMany({
          where: { id: { in: [...groupOf.keys()] } },
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
      groups: CSAT_GROUPS.map((g) => ({ collection: g.collection, title: g.title, subject: g.subject })),
      sets: sets
        .sort((a, b) => (groupOf.get(a.id)?.order ?? 0) - (groupOf.get(b.id)?.order ?? 0))
        .map((s) => ({
          id: s.id,
          group: groupOf.get(s.id)?.collection ?? CSAT_GROUPS[0].collection,
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
