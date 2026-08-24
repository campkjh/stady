import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 페이지 체류(어떤 페이지에 얼마나 머물렀는지) 수집/집계.
// 이 레포 관습대로 Prisma 마이그레이션 없이 raw SQL + ensure 패턴으로 테이블을 관리한다.
// ⚠️ Neon 함정: SELECT * 로 읽는 테이블에 나중에 컬럼을 ALTER 하면 "cached plan must not
//    change result type" 500 이 난다. → 처음부터 필요한 컬럼을 다 만들고, 조회는 항상 컬럼 명시.

export interface PageDwellStat {
  path: string;
  views: number;
  totalMinutes: number;
  avgSeconds: number;
  users: number;
}

export interface HourlyActivity {
  hour: number; // 0~23 (KST)
  views: number;
}

export const MIN_DWELL_MS = 3_000; // 3초 미만은 스쳐 지나간 것 → 버린다
export const MAX_DWELL_MS = 30 * 60 * 1000; // 탭 방치 방지용 상한(30분)
const MAX_PATH_LENGTH = 200;

let pageViewTableReady = false;

export async function ensurePageViewTable(): Promise<void> {
  if (pageViewTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PageView" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT,
      "path" TEXT NOT NULL,
      "dwell_ms" INTEGER NOT NULL,
      "started_at" TIMESTAMP NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView" ("path")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PageView_started_at_idx" ON "PageView" ("started_at")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PageView_user_id_idx" ON "PageView" ("user_id")`
  );
  pageViewTableReady = true;
}

/* ── 경로 정규화 ────────────────────────────────────────────────
   동적 세그먼트를 그대로 저장하면 카디널리티가 폭발한다(글 하나당 행 하나).
   uuid/숫자 같은 id 세그먼트를 [id] 자리표시자로 바꾸고 쿼리스트링은 버린다.
     /community/9f3e…       → /community/[id]
     /ox-quiz/abc…          → /ox-quiz/[id]
     /mock-exam/…/solve     → /mock-exam/[id]/solve
   단, /community/write 처럼 부모가 동적이어도 실제로는 정적인 라우트가 있어
   부모별 "정적 자식" 예외 목록을 함께 둔다.                                */

// 부모 세그먼트 → 그 아래에서 id 로 취급하지 않을 정적 세그먼트들
const DYNAMIC_PARENTS: Record<string, string[]> = {
  community: ["write"],
  "ox-quiz": [],
  "vocab-quiz": [],
  "mock-exam": [],
  workbook: [],
  category: [],
};

// 수집하지 않는 경로(관리자 화면·내부 경로는 통계를 오염시킨다)
const IGNORED_PREFIXES = ["/api", "/_next", "/admin", "/admin-login"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_RE = /^c[a-z0-9]{20,}$/i;
const HEX_RE = /^[0-9a-f]{16,}$/i;
const NUMERIC_RE = /^\d+$/;
// 공백·제어문자가 섞인 경로는 수집 대상이 아니다.
const UNSAFE_RE = /[\s\u0000-\u001f\u007f]/;

function looksLikeId(seg: string): boolean {
  if (UUID_RE.test(seg) || CUID_RE.test(seg) || HEX_RE.test(seg)) return true;
  if (NUMERIC_RE.test(seg)) return true;
  // uuid 앞부분만 넘어오는 등 "길고 숫자가 섞인 무의미 토큰"도 id 로 본다.
  // (korean-history · subscription 같은 정적 슬러그는 숫자가 없어 걸리지 않는다)
  if (seg.length >= 12 && /\d/.test(seg)) return true;
  return false;
}

/** 수집 대상이 아니거나 정규화가 불가능하면 null. */
export function normalizePath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p.startsWith("/")) return null;
  if (UNSAFE_RE.test(p)) return null;

  // 쿼리스트링·해시는 버린다
  p = p.split("?")[0].split("#")[0];
  // 중복 슬래시 정리 + 끝 슬래시 제거(루트 제외)
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  if (p === "" || p === "/") return "/";

  if (IGNORED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) return null;

  const segments = p.split("/").filter(Boolean);
  // 마지막 세그먼트에 확장자가 있으면 정적 파일 요청 → 수집 대상 아님
  if (/\.[a-z0-9]{2,5}$/i.test(segments[segments.length - 1] ?? "")) return null;

  const out: string[] = [];
  for (let i = 0; i < segments.length && i < 6; i++) {
    const seg = segments[i];
    const parent = i > 0 ? segments[i - 1] : null;
    const staticChildren = parent ? DYNAMIC_PARENTS[parent] : undefined;
    if (staticChildren && !staticChildren.includes(seg)) {
      out.push("[id]");
      continue;
    }
    out.push(looksLikeId(seg) ? "[id]" : seg);
  }

  const normalized = `/${out.join("/")}`;
  return normalized.length > MAX_PATH_LENGTH ? normalized.slice(0, MAX_PATH_LENGTH) : normalized;
}

/* ── 기록 ─────────────────────────────────────────────────────── */

export async function recordPageView(params: {
  userId: string | null;
  path: string;
  dwellMs: number;
  startedAt: Date;
}): Promise<void> {
  const path = normalizePath(params.path);
  if (!path) return;

  const dwellMs = Math.round(params.dwellMs);
  if (!Number.isFinite(dwellMs) || dwellMs < MIN_DWELL_MS || dwellMs > MAX_DWELL_MS) return;

  const startedAt = params.startedAt;
  if (!(startedAt instanceof Date) || Number.isNaN(startedAt.getTime())) return;

  await ensurePageViewTable();
  // 저장은 UTC 벽시계로 고정한다(세션 타임존에 흔들리지 않게 명시 캐스팅).
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PageView" ("id", "user_id", "path", "dwell_ms", "started_at", "created_at")
     VALUES ($1, $2::text, $3, $4::int, ($5::timestamptz AT TIME ZONE 'utc'), (now() AT TIME ZONE 'utc'))`,
    randomUUID(),
    params.userId,
    path,
    dwellMs,
    startedAt.toISOString()
  );
}

/* ── 집계 (인사이트 페이지 계약) ─────────────────────────────── */

function safeDays(days: number): number {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n)) return 7;
  return Math.min(365, Math.max(1, n));
}

/** 경로별 체류 통계. totalMinutes 내림차순. 데이터가 없으면 빈 배열. */
export async function getPageDwellStats(days: number): Promise<PageDwellStat[]> {
  const window = safeDays(days);
  try {
    await ensurePageViewTable();
    const rows = await prisma.$queryRawUnsafe<
      { path: string; views: number; total_ms: number; users: number }[]
    >(
      `SELECT "path" AS path,
              COUNT(*)::int AS views,
              COALESCE(SUM("dwell_ms"), 0)::float8 AS total_ms,
              COUNT(DISTINCT "user_id")::int AS users
         FROM "PageView"
        WHERE "started_at" >= (now() AT TIME ZONE 'utc') - make_interval(days => $1::int)
        GROUP BY "path"
        ORDER BY total_ms DESC
        LIMIT 200`,
      window
    );

    return rows.map((r) => {
      const views = Number(r.views) || 0;
      const totalMs = Number(r.total_ms) || 0;
      return {
        path: r.path,
        views,
        totalMinutes: Math.round((totalMs / 60000) * 10) / 10,
        avgSeconds: views > 0 ? Math.round(totalMs / views / 1000) : 0,
        users: Number(r.users) || 0,
      };
    });
  } catch (error) {
    // 집계 실패로 관리자 화면이 죽지 않게 한다("수집 중" 안내가 대신 뜬다).
    console.error("getPageDwellStats error:", error);
    return [];
  }
}

/**
 * 시간대별 활동량. hour 는 KST(Asia/Seoul) 기준 0~23.
 * DB 는 UTC 벽시계로 저장하므로 반드시 시간대 변환을 거친다.
 * 데이터가 하나라도 있으면 0~23시 24칸을 모두 채워 반환(빈 시간대는 views 0),
 * 아예 없으면 빈 배열.
 */
export async function getHourlyActivity(days: number): Promise<HourlyActivity[]> {
  const window = safeDays(days);
  try {
    await ensurePageViewTable();
    const rows = await prisma.$queryRawUnsafe<{ hour: number; views: number }[]>(
      `SELECT EXTRACT(HOUR FROM (("started_at" AT TIME ZONE 'utc') AT TIME ZONE 'Asia/Seoul'))::int AS hour,
              COUNT(*)::int AS views
         FROM "PageView"
        WHERE "started_at" >= (now() AT TIME ZONE 'utc') - make_interval(days => $1::int)
        GROUP BY 1
        ORDER BY 1`,
      window
    );
    if (rows.length === 0) return [];

    const byHour = new Map<number, number>();
    for (const r of rows) byHour.set(Number(r.hour), Number(r.views) || 0);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, views: byHour.get(hour) ?? 0 }));
  } catch (error) {
    console.error("getHourlyActivity error:", error);
    return [];
  }
}
