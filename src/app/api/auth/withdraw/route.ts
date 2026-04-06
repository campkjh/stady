import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reason, detail, email } = body;

    const currentUser = await getCurrentUser();

    // Logged-in user: delete immediately
    if (currentUser) {
      await prisma.$transaction([
        prisma.bookmark.deleteMany({ where: { userId: currentUser.id } }),
        prisma.review.deleteMany({ where: { userId: currentUser.id } }),
        prisma.problemAnswer.deleteMany({ where: { attempt: { userId: currentUser.id } } }),
        prisma.oxAnswer.deleteMany({ where: { attempt: { userId: currentUser.id } } }),
        prisma.vocabAnswer.deleteMany({ where: { attempt: { userId: currentUser.id } } }),
        prisma.quizAttempt.deleteMany({ where: { userId: currentUser.id } }),
        prisma.user.delete({ where: { id: currentUser.id } }),
      ]);

      const cookieStore = await cookies();
      cookieStore.set("userId", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      console.log(`User withdrawn: ${currentUser.id}, reason: ${reason}, detail: ${detail || "N/A"}`);
      return NextResponse.json({ message: "회원탈퇴가 완료되었습니다." });
    }

    // Not logged in: delete by email
    if (!email) {
      return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "해당 이메일로 가입된 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.bookmark.deleteMany({ where: { userId: user.id } }),
      prisma.review.deleteMany({ where: { userId: user.id } }),
      prisma.problemAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.oxAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.vocabAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.quizAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    console.log(`User withdrawn by email: ${email}, reason: ${reason}, detail: ${detail || "N/A"}`);
    return NextResponse.json({ message: "회원탈퇴가 완료되었습니다." });
  } catch (error) {
    console.error("Withdraw error:", error);
    return NextResponse.json(
      { error: "회원탈퇴 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
