import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// 어드민 회원 목록 한 행. avatar(data URL)·User-Agent·lastLoginIp 는 화면에 쓰지 않는데
// 7천 명분을 매번 실어 나르느라 응답이 6.5MB/9초였다 — 목록에는 싣지 않는다.
export interface AdminUserRow {
  id: string;
  email: string;
  nickname: string;
  role: string;
  signupSource: string | null;
  phone: string | null;
  signupDevice: string | null;
  signupIp: string | null;
  lastLoginAt: Date | null;
  lastLoginDevice: string | null;
  createdAt: Date;
  attemptCount: bigint | number;
  inquiryCount: bigint | number;
  totalStudySeconds: bigint | number;
}

let columnsReady = false;
export async function ensureUserAdminProfileColumns() {
  if (columnsReady) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "phone" TEXT,
    ADD COLUMN IF NOT EXISTS "signupDevice" TEXT,
    ADD COLUMN IF NOT EXISTS "signupUserAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "signupIp" TEXT,
    ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastLoginDevice" TEXT,
    ADD COLUMN IF NOT EXISTS "lastLoginUserAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT
  `);
  // 목록이 createdAt DESC + LIMIT 라 정렬 인덱스가 있으면 페이지 조회가 가볍다.
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt" DESC)`);
  columnsReady = true;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || null;
}

export function detectDevice(userAgent: string | null) {
  if (!userAgent) return "알 수 없음";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("mac os")
          ? "Mac"
          : ua.includes("windows")
            ? "Windows"
            : ua.includes("linux")
              ? "Linux"
              : "기타";
  const browser = ua.includes("kakaotalk")
    ? "KakaoTalk"
    : ua.includes("edg/")
      ? "Edge"
      : ua.includes("chrome/")
        ? "Chrome"
        : ua.includes("safari/")
          ? "Safari"
          : "브라우저";
  return `${os} · ${browser}`;
}

export async function recordUserAccessMetadata(request: NextRequest, userId: string, isNewUser: boolean) {
  await ensureUserAdminProfileColumns();

  const userAgent = request.headers.get("user-agent");
  const device = detectDevice(userAgent);
  const ip = getClientIp(request);

  if (isNewUser) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "User"
        SET
          "signupDevice" = COALESCE("signupDevice", $2),
          "signupUserAgent" = COALESCE("signupUserAgent", $3),
          "signupIp" = COALESCE("signupIp", $4),
          "lastLoginAt" = CURRENT_TIMESTAMP,
          "lastLoginDevice" = $2,
          "lastLoginUserAgent" = $3,
          "lastLoginIp" = $4
        WHERE "id" = $1
      `,
      userId,
      device,
      userAgent,
      ip
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE "User"
      SET
        "lastLoginAt" = CURRENT_TIMESTAMP,
        "lastLoginDevice" = $2,
        "lastLoginUserAgent" = $3,
        "lastLoginIp" = $4
      WHERE "id" = $1
    `,
    userId,
    device,
    userAgent,
    ip
  );
}

export interface AdminUserStats {
  total: number;
  admins: number;
  joinedToday: number;
}

/** 회원 목록 페이지 조회. 검색은 서버에서(닉네임·이메일·전화·가입경로·가입기기·최근기기). */
export async function getAdminUsersPage(opts: { q?: string; page?: number; limit?: number }) {
  await ensureUserAdminProfileColumns();
  const limit = Math.min(200, Math.max(1, Math.trunc(opts.limit ?? 50)));
  const page = Math.max(1, Math.trunc(opts.page ?? 1));
  const offset = (page - 1) * limit;
  const q = (opts.q ?? "").trim();
  const params: unknown[] = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE u."nickname" ILIKE $1 OR u."email" ILIKE $1 OR u."phone" ILIKE $1
      OR u."signupSource" ILIKE $1 OR u."signupDevice" ILIKE $1 OR u."lastLoginDevice" ILIKE $1`;
  }

  // 활동 집계는 이 페이지의 행에 대해서만 상관 서브쿼리로 센다(전체 GROUP BY 는 표 크기에 비례).
  // 전체 건수는 별도 COUNT 왕복 대신 윈도 함수로 같은 쿼리에서 받는다(Neon 왕복 1회 절약).
  const rows = await prisma.$queryRawUnsafe<(AdminUserRow & { _total: bigint | number })[]>(
    `
    SELECT
      COUNT(*) OVER() AS "_total",
      u."id", u."email", u."nickname", u."role", u."signupSource", u."phone",
      u."signupDevice", u."signupIp", u."lastLoginAt", u."lastLoginDevice", u."createdAt",
      (SELECT COUNT(*) FROM "QuizAttempt" x WHERE x."userId" = u."id") AS "attemptCount",
      (SELECT COUNT(*) FROM "Inquiry" x WHERE x."userId" = u."id") AS "inquiryCount",
      (SELECT COALESCE(SUM("totalSeconds"), 0) FROM "StudySession" x WHERE x."userId" = u."id") AS "totalStudySeconds"
    FROM "User" u
    ${where}
    ORDER BY u."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    ...params
  );

  const total = rows.length ? Number(rows[0]._total) : 0;
  const users = rows.map(({ _total: _omit, ...u }) => u as AdminUserRow);
  return { users, total, page, limit };
}

/** 상단 요약 카드용 — 전체/관리자/오늘 가입(KST). 목록과 분리해 한 번만 센다. */
export async function getAdminUserStats(): Promise<AdminUserStats> {
  await ensureUserAdminProfileColumns();
  const [r] = await prisma.$queryRawUnsafe<{ total: number; admins: number; joined_today: number }[]>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "role" = 'admin')::int AS admins,
      COUNT(*) FILTER (
        WHERE "createdAt" >= (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')
      )::int AS joined_today
    FROM "User"
  `);
  return { total: r?.total ?? 0, admins: r?.admins ?? 0, joinedToday: r?.joined_today ?? 0 };
}
