import { prisma } from "@/lib/prisma";

// 수능대비자료(2026-10-29, 구 '엘리트 모의고사' 바로가기) — 프리미엄 구독자 전용 파이널 자료 묶음.
//  - 문제집: 엘리트 모의고사(WorkbookPremium 으로 이미 유료 지정)
//  - OX: 사상가별 파이널 선지(단원별 세트, 소분류=사상가). 일반 OX 목록에는 띄우지 않고 여기서만 연다.
// OxQuizSet 은 SELECT * 테이블이라 컬럼을 붙이지 않고 사이드 테이블로 묶는다(stady-neon-cachedplan-pitfall).
export const CSAT_COLLECTION = "csat-final";

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

/** 수능대비자료 OX 세트 id → 순서. 조회 실패는 빈 값(일반 목록이 깨지면 안 된다). */
export async function getCsatOxOrder(): Promise<Map<string, number>> {
  try {
    await ensureCsatTable();
    const rows = await prisma.$queryRawUnsafe<{ set_id: string; sort_order: number }[]>(
      `SELECT "set_id", "sort_order" FROM "OxSetCollection" WHERE "collection" = $1`,
      CSAT_COLLECTION
    );
    return new Map(rows.map((r) => [r.set_id, r.sort_order]));
  } catch (error) {
    console.error("getCsatOxOrder failed:", error);
    return new Map();
  }
}

export async function getCsatOxSetIds(): Promise<Set<string>> {
  return new Set((await getCsatOxOrder()).keys());
}
