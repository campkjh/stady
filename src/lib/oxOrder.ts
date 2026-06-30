import { prisma } from "@/lib/prisma";

// OX 퀴즈 세트의 노출 순서(관리자 지정). OxQuizSet 테이블을 ALTER하지 않고 별도 테이블로
// 관리 → Neon 캐시플랜 이슈 회피(기존 raw SELECT * 와 무관). 작을수록 위.

let ready = false;

export async function ensureOxOrderTable(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OxSetOrder" (
      "set_id" TEXT PRIMARY KEY,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  ready = true;
}

// { setId: sortOrder } 맵.
export async function getOxOrderMap(): Promise<Record<string, number>> {
  await ensureOxOrderTable();
  const rows = await prisma.$queryRawUnsafe<{ set_id: string; sort_order: number }[]>(
    `SELECT "set_id", "sort_order" FROM "OxSetOrder"`
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.set_id] = r.sort_order;
  return map;
}

// 여러 세트의 순서를 일괄 저장(upsert).
export async function setOxOrders(orders: { setId: string; sortOrder: number }[]): Promise<void> {
  await ensureOxOrderTable();
  for (const o of orders) {
    if (!o.setId) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "OxSetOrder" ("set_id", "sort_order", "updated_at") VALUES ($1, $2, now())
       ON CONFLICT ("set_id") DO UPDATE SET "sort_order" = EXCLUDED."sort_order", "updated_at" = now()`,
      o.setId,
      Math.trunc(Number(o.sortOrder) || 0)
    );
  }
}
