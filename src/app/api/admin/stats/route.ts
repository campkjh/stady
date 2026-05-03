import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureReferralTable, makeInviteCode } from "@/lib/referrals";

interface ReferralInviteRow {
  inviterId: string;
  inviterNickname: string;
  inviterEmail: string;
  inviteeId: string;
  inviteeNickname: string;
  inviteeEmail: string;
  invitedAt: Date;
}

export async function GET() {
  try {
    await requireAdmin();
    await ensureReferralTable();

    const [
      workbookCount,
      oxQuizSetCount,
      vocabQuizSetCount,
      userCount,
      inquiryCount,
      sourceResults,
      recentUsers,
      recentInquiries,
      referralRows,
    ] = await Promise.all([
      prisma.workbook.count(),
      prisma.oxQuizSet.count(),
      prisma.vocabQuizSet.count(),
      prisma.user.count(),
      prisma.inquiry.count(),
      prisma.user.groupBy({
        by: ["signupSource"],
        _count: { signupSource: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          nickname: true,
          email: true,
          signupSource: true,
          createdAt: true,
        },
      }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          category: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.$queryRawUnsafe<ReferralInviteRow[]>(
        `
          SELECT
            inviter."id" AS "inviterId",
            inviter."nickname" AS "inviterNickname",
            inviter."email" AS "inviterEmail",
            invitee."id" AS "inviteeId",
            invitee."nickname" AS "inviteeNickname",
            invitee."email" AS "inviteeEmail",
            r."createdAt" AS "invitedAt"
          FROM "ReferralInvite" r
          JOIN "User" inviter ON inviter."id" = r."inviterId"
          JOIN "User" invitee ON invitee."id" = r."inviteeId"
          ORDER BY r."createdAt" DESC
        `
      ),
    ]);

    const sources = sourceResults.map((r) => ({
      source: r.signupSource || "미응답",
      count: r._count.signupSource,
    }));

    const referralMap = new Map<string, {
      inviterId: string;
      nickname: string;
      email: string;
      inviteCode: string;
      invitedCount: number;
      invitees: {
        id: string;
        nickname: string;
        email: string;
        invitedAt: Date;
      }[];
    }>();

    for (const row of referralRows) {
      const inviter = referralMap.get(row.inviterId) || {
        inviterId: row.inviterId,
        nickname: row.inviterNickname,
        email: row.inviterEmail,
        inviteCode: makeInviteCode(row.inviterId),
        invitedCount: 0,
        invitees: [],
      };
      inviter.invitedCount += 1;
      inviter.invitees.push({
        id: row.inviteeId,
        nickname: row.inviteeNickname,
        email: row.inviteeEmail,
        invitedAt: row.invitedAt,
      });
      referralMap.set(row.inviterId, inviter);
    }

    const referralStats = {
      totalInvites: referralRows.length,
      inviters: Array.from(referralMap.values()).sort((a, b) => b.invitedCount - a.invitedCount),
    };

    return NextResponse.json({
      counts: {
        workbooks: workbookCount,
        oxQuizSets: oxQuizSetCount,
        vocabQuizSets: vocabQuizSetCount,
        users: userCount,
        inquiries: inquiryCount,
      },
      sources,
      recentUsers,
      recentInquiries,
      referralStats,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
