import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// 온보딩 설문(평생 1회): 만족도 + 원하는 기능. 사용자당 1행(user_id UNIQUE).
// 커뮤니티/데일리와 동일하게 마이그레이션 없이 raw SQL로 관리.

let surveyTableReady = false;

export async function ensureSurveyTable(): Promise<void> {
  if (surveyTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserSurvey" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL UNIQUE,
      "satisfaction" INTEGER,
      "desired_feature" TEXT NOT NULL DEFAULT '',
      "skipped" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  surveyTableReady = true;
}

// 사용자가 이미 설문에 응답(또는 건너뛰기)했는지.
export async function hasSurvey(userId: string): Promise<boolean> {
  await ensureSurveyTable();
  const rows = await prisma.$queryRawUnsafe<{ one: number }[]>(
    `SELECT 1 AS one FROM "UserSurvey" WHERE "user_id" = $1 LIMIT 1`,
    userId
  );
  return rows.length > 0;
}

// 설문 기록(응답/건너뛰기 모두 1행). 이미 있으면 무시 → 평생 1회.
export async function recordSurvey(
  userId: string,
  satisfaction: number | null,
  desiredFeature: string,
  skipped: boolean
): Promise<void> {
  await ensureSurveyTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserSurvey" ("id", "user_id", "satisfaction", "desired_feature", "skipped")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("user_id") DO NOTHING`,
    randomUUID(),
    userId,
    satisfaction,
    desiredFeature,
    skipped
  );
}

export interface SurveyRow {
  id: string;
  userId: string;
  nickname: string;
  email: string;
  satisfaction: number | null;
  desiredFeature: string;
  skipped: boolean;
  createdAt: Date;
}

// 어드민용 전체 설문 응답(최신순) + 유저 정보 조인.
export async function getAllSurveys(): Promise<SurveyRow[]> {
  await ensureSurveyTable();
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      user_id: string;
      nickname: string | null;
      email: string | null;
      satisfaction: number | null;
      desired_feature: string;
      skipped: boolean;
      created_at: Date;
    }[]
  >(
    `SELECT s."id", s."user_id", u."nickname", u."email", s."satisfaction",
            s."desired_feature", s."skipped", s."created_at"
     FROM "UserSurvey" s
     LEFT JOIN "User" u ON u."id" = s."user_id"
     ORDER BY s."created_at" DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    nickname: r.nickname ?? "(탈퇴/알수없음)",
    email: r.email ?? "",
    satisfaction: r.satisfaction,
    desiredFeature: r.desired_feature,
    skipped: r.skipped,
    createdAt: r.created_at,
  }));
}
