import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { REFERRAL_EVENT_PATH } from "@/lib/referrals";

export const runtime = "nodejs";

interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string;
  bannerType: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

async function ensureBannerTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeBanner" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "subtitle" TEXT,
      "imageUrl" TEXT,
      "linkUrl" TEXT,
      "bgColor" TEXT NOT NULL DEFAULT '#3787FF',
      "bannerType" TEXT NOT NULL DEFAULT 'slide',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "HomeBanner"
    ADD COLUMN IF NOT EXISTS "bannerType" TEXT NOT NULL DEFAULT 'slide'
  `);

  const defaultRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "HomeBanner" WHERE "imageUrl" = '/banners/referral-event.png' LIMIT 1`
  );
  if (defaultRows.length === 0) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "HomeBanner" ("id", "title", "subtitle", "imageUrl", "linkUrl", "bgColor", "bannerType", "sortOrder", "isActive")
        VALUES ($1, $2, $3, $4, $5, $6, 'modal', -100, true)
      `,
      randomUUID(),
      "스타디 1달 오픈베타 이벤트!",
      "친구를 초대할수록 더 커지는 혜택",
      "/banners/referral-event.png",
      REFERRAL_EVENT_PATH,
      "#EAF3FF"
    );
  }

  const defaultSlideRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "HomeBanner" WHERE "imageUrl" = '/banners/referral-slide.png' LIMIT 1`
  );
  if (defaultSlideRows.length === 0) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "HomeBanner" ("id", "title", "subtitle", "imageUrl", "linkUrl", "bgColor", "bannerType", "sortOrder", "isActive")
        VALUES ($1, $2, $3, $4, $5, $6, 'slide', -90, true)
      `,
      randomUUID(),
      "스타디 1달 오픈베타 이벤트!",
      "친구를 초대할수록 더 커지는 혜택",
      "/banners/referral-slide.png",
      REFERRAL_EVENT_PATH,
      "#EAF3FF"
    );
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE "HomeBanner"
      SET "linkUrl" = $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "imageUrl" IN ('/banners/referral-event.png', '/banners/referral-slide.png')
        AND ("linkUrl" IS NULL OR "linkUrl" = '/timer')
    `,
    REFERRAL_EVENT_PATH
  );
}

function normalizeBanner(row: BannerRow) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
    bgColor: row.bgColor,
    bannerType: row.bannerType,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureBannerTable();
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "1" && user?.role === "admin";

    const rows = await prisma.$queryRawUnsafe<BannerRow[]>(
      `
        SELECT "id", "title", "subtitle", "imageUrl", "linkUrl", "bgColor", "bannerType", "sortOrder", "isActive", "createdAt"
        FROM "HomeBanner"
        ${includeInactive ? "" : `WHERE "isActive" = true`}
        ORDER BY "sortOrder" ASC, "createdAt" DESC
      `
    );

    return NextResponse.json({ banners: rows.map(normalizeBanner) });
  } catch (error) {
    console.error("Banners GET error:", error);
    return NextResponse.json({ error: "배너를 가져오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await ensureBannerTable();
    const body = await request.json();
    const title = (body.title || "").toString().trim();
    if (!title) {
      return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "HomeBanner" ("id", "title", "subtitle", "imageUrl", "linkUrl", "bgColor", "bannerType", "sortOrder", "isActive")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      randomUUID(),
      title,
      body.subtitle ? body.subtitle.toString() : null,
      body.imageUrl ? body.imageUrl.toString() : null,
      body.linkUrl ? body.linkUrl.toString() : null,
      body.bgColor ? body.bgColor.toString() : "#3787FF",
      body.bannerType === "modal" ? "modal" : "slide",
      Number(body.sortOrder || 0),
      body.isActive !== false
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Banners POST error:", error);
    return NextResponse.json({ error: "배너를 추가하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    await ensureBannerTable();
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "배너 ID는 필수입니다." }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `
        UPDATE "HomeBanner"
        SET "title" = $2, "subtitle" = $3, "imageUrl" = $4, "linkUrl" = $5,
            "bgColor" = $6, "bannerType" = $7, "sortOrder" = $8, "isActive" = $9, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      body.id.toString(),
      (body.title || "").toString().trim(),
      body.subtitle ? body.subtitle.toString() : null,
      body.imageUrl ? body.imageUrl.toString() : null,
      body.linkUrl ? body.linkUrl.toString() : null,
      body.bgColor ? body.bgColor.toString() : "#3787FF",
      body.bannerType === "modal" ? "modal" : "slide",
      Number(body.sortOrder || 0),
      body.isActive !== false
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Banners PATCH error:", error);
    return NextResponse.json({ error: "배너를 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    await ensureBannerTable();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "배너 ID는 필수입니다." }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "HomeBanner" WHERE "id" = $1`, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    console.error("Banners DELETE error:", error);
    return NextResponse.json({ error: "배너를 삭제하지 못했습니다." }, { status: 500 });
  }
}
