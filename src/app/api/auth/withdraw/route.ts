import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { reason, detail } = body;

    // Delete all user-related data
    await prisma.$transaction([
      prisma.bookmark.deleteMany({ where: { userId: user.id } }),
      prisma.review.deleteMany({ where: { userId: user.id } }),
      prisma.problemAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.oxAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.vocabAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.quizAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    // Clear session cookie
    const cookieStore = await cookies();
    cookieStore.set("userId", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    console.log(`User withdrawn: ${user.id}, reason: ${reason}, detail: ${detail || "N/A"}`);

    return NextResponse.json({ message: "회원탈퇴가 완료되었습니다." });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Withdraw error:", error);
    return NextResponse.json(
      { error: "회원탈퇴 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
