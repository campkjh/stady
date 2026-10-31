import { prisma } from "@/lib/prisma";

// 수능대비자료(2026-10-29, 구 '엘리트 모의고사' 바로가기) — 프리미엄 구독자 전용 파이널 자료 묶음.
//  - 문제집: 엘리트 모의고사(WorkbookPremium 으로 이미 유료 지정)
//  - OX: 사상가별 파이널 선지(단원별 세트, 소분류=사상가). 일반 OX 목록에는 띄우지 않고 여기서만 연다.
// OxQuizSet 은 SELECT * 테이블이라 컬럼을 붙이지 않고 사이드 테이블로 묶는다(stady-neon-cachedplan-pitfall).
export const CSAT_COLLECTION = "csat-final";

// 수능대비자료의 OX 묶음들(화면에 카드 하나씩). collection = OxSetCollection."collection".
export const CSAT_GROUPS = [
  { collection: "csat-final", title: "사상가별 파이널 선지", subject: "생활과 윤리" },
  { collection: "csat-ethics-thought", title: "사상가별 고난도 선지", subject: "윤리와 사상" },
] as const;
const CSAT_COLLECTIONS = CSAT_GROUPS.map((g) => g.collection);

let tableReady = false;
export async function ensureCsatTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OxSetCollection" (
      "set_id" TEXT PRIMARY KEY REFERENCES "OxQuizSet"("id") ON DELETE CASCADE,
      "collection" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

/** 수능대비자료 OX 세트 id → {묶음, 순서}. 조회 실패는 빈 값(일반 목록이 깨지면 안 된다). */
export async function getCsatOxGroups(): Promise<Map<string, { collection: string; order: number }>> {
  try {
    await ensureCsatTable();
    const ph = CSAT_COLLECTIONS.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await prisma.$queryRawUnsafe<{ set_id: string; collection: string; sort_order: number }[]>(
      `SELECT "set_id", "collection", "sort_order" FROM "OxSetCollection" WHERE "collection" IN (${ph})`,
      ...CSAT_COLLECTIONS
    );
    return new Map(rows.map((r) => [r.set_id, { collection: r.collection, order: r.sort_order }]));
  } catch (error) {
    console.error("getCsatOxGroups failed:", error);
    return new Map();
  }
}

/** 수능대비자료 OX 세트 id → 순서(모든 묶음). */
export async function getCsatOxOrder(): Promise<Map<string, number>> {
  const groups = await getCsatOxGroups();
  return new Map([...groups].map(([id, g]) => [id, g.order]));
}

export async function getCsatOxSetIds(): Promise<Set<string>> {
  return new Set((await getCsatOxOrder()).keys());
}
