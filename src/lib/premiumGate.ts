import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPremium } from "@/lib/iap/entitlements";
import { getOxOrderMap } from "@/lib/oxOrder";

// 프리미엄 접근 정책 (2026-08-29) — 단일 진실 공급원.
//  - 생윤(생활과윤리)·윤사(윤리와사상): 각 과목의 "가장 앞 N개 소단원"만 무료, 나머지는 프리미엄
//  - 모의고사: 전부 프리미엄
//  - 문제집: WorkbookPremium 에 등록된 것만 프리미엄(엘리트 모의고사 등)
//  - 그 외(단어·커뮤니티·다른 OX 카테고리 등): 제약 없음(그대로)
// 무료 개수를 "과목 합산 5개"로 바꾸려면 아래 상수/로직만 조정하면 된다.
export const PREMIUM_OX_CATEGORY_NAMES = ["생활과윤리", "윤리와사상"];
export const FREE_OX_SETS_PER_CATEGORY = 5;

// 프리미엄 잠금 대상 OxQuizSet id 집합.
// = 프리미엄 카테고리(생윤·윤사)에서, 노출 순서(OxSetOrder → createdAt)상 앞 5개를 뺀 나머지.
// 정렬 기준은 목록 API(/api/ox-quiz)·인트로가 쓰는 것과 동일해야 "앞 5개"가 화면과 일치한다.
export async function getLockedOxSetIds(): Promise<Set<string>> {
  const sets = await prisma.oxQuizSet.findMany({
    where: { category: { name: { in: PREMIUM_OX_CATEGORY_NAMES } } },
    select: { id: true, categoryId: true, createdAt: true },
  });
  const orderMap = await getOxOrderMap();

  const byCat = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = byCat.get(s.categoryId) ?? [];
    arr.push(s);
    byCat.set(s.categoryId, arr);
  }

  const locked = new Set<string>();
  for (const arr of byCat.values()) {
    arr.sort((a, b) => {
      const oa = orderMap[a.id] ?? Number.MAX_SAFE_INTEGER;
      const ob = orderMap[b.id] ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    arr.forEach((s, i) => {
      if (i >= FREE_OX_SETS_PER_CATEGORY) locked.add(s.id);
    });
  }
  return locked;
}

// ── 문제집(Workbook) 프리미엄 ────────────────────────────────────
// OX 처럼 "앞 N개 무료" 규칙이 아니라 **문제집 단위로 지정**한다(엘리트 모의고사 등 유료 편성).
// Workbook 에 컬럼을 붙이지 않고 사이드 테이블로 두는 이유는 이 저장소의 기존 방침과 같다.
let workbookTableReady = false;
export async function ensurePremiumWorkbookTable(): Promise<void> {
  if (workbookTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WorkbookPremium" (
      "workbook_id" TEXT PRIMARY KEY REFERENCES "Workbook"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  workbookTableReady = true;
}

/** 프리미엄 전용으로 지정된 문제집 id 집합. 조회 실패는 "잠금 없음"으로 흘린다(목록이 깨지면 안 된다). */
export async function getPremiumWorkbookIds(): Promise<Set<string>> {
  try {
    await ensurePremiumWorkbookTable();
    const rows = await prisma.$queryRawUnsafe<{ workbook_id: string }[]>(
      `SELECT "workbook_id" FROM "WorkbookPremium"`
    );
    return new Set(rows.map((r) => r.workbook_id));
  } catch (error) {
    console.error("getPremiumWorkbookIds failed:", error);
    return new Set();
  }
}

/** 단일 문제집이 프리미엄 잠금 대상인지. */
export async function isWorkbookLocked(workbookId: string): Promise<boolean> {
  return (await getPremiumWorkbookIds()).has(workbookId);
}

// 단일 OX 세트가 프리미엄 잠금 대상인지.
export async function isOxSetLocked(setId: string): Promise<boolean> {
  return (await getLockedOxSetIds()).has(setId);
}

// 현재 요청자가 잠금을 통과할 자격이 있는지 — 프리미엄 구독자 또는 관리자.
// 서버 컨텍스트(route handler·server component)에서만 호출 가능(getCurrentUser가 쿠키를 읽음).
export async function viewerHasPremiumAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  try {
    return await isPremium(user.id);
  } catch {
    // 구독권 조회 실패 시 잠금 유지(무료 콘텐츠는 애초에 이 함수를 안 탄다).
    return false;
  }
}
