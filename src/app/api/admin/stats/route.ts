import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const [
      workbookCount,
      oxQuizSetCount,
      vocabQuizSetCount,
      userCount,
      inquiryCount,
      sourceResults,
      recentUsers,
      recentInquiries,
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
    ]);

    const sources = sourceResults.map((r) => ({
      source: r.signupSource || "미응답",
      count: r._count.signupSource,
    }));

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
