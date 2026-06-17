import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export interface AdminUserRow {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  role: string;
  signupSource: string | null;
  phone: string | null;
  signupDevice: string | null;
  signupIp: string | null;
  signupUserAgent: string | null;
  lastLoginAt: Date | null;
  lastLoginDevice: string | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  createdAt: Date;
  attemptCount: bigint | number;
  inquiryCount: bigint | number;
  totalStudySeconds: bigint | number;
}

export async function ensureUserAdminProfileColumns() {
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

export async function getAdminUsers() {
  await ensureUserAdminProfileColumns();

  return prisma.$queryRawUnsafe<AdminUserRow[]>(`
    SELECT
      u."id",
      u."email",
      u."nickname",
      u."avatar",
      u."role",
      u."signupSource",
      u."phone",
      u."signupDevice",
      u."signupIp",
      u."signupUserAgent",
      u."lastLoginAt",
      u."lastLoginDevice",
      u."lastLoginIp",
      u."lastLoginUserAgent",
      u."createdAt",
      COALESCE(a."attemptCount", 0) AS "attemptCount",
      COALESCE(i."inquiryCount", 0) AS "inquiryCount",
      COALESCE(s."totalStudySeconds", 0) AS "totalStudySeconds"
    FROM "User" u
    LEFT JOIN (
      SELECT "userId", COUNT(*) AS "attemptCount"
      FROM "QuizAttempt"
      GROUP BY "userId"
    ) a ON a."userId" = u."id"
    LEFT JOIN (
      SELECT "userId", COUNT(*) AS "inquiryCount"
      FROM "Inquiry"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"
    ) i ON i."userId" = u."id"
    LEFT JOIN (
      SELECT "userId", SUM("totalSeconds") AS "totalStudySeconds"
      FROM "StudySession"
      GROUP BY "userId"
    ) s ON s."userId" = u."id"
    ORDER BY u."createdAt" DESC
  `);
}
