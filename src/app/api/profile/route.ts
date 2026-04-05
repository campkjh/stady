import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "프로필을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const { nickname, avatar } = await request.json();

    const data: Record<string, unknown> = {};
    if (nickname !== undefined) data.nickname = nickname;
    if (avatar !== undefined) data.avatar = avatar;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    const { password: _, ...userWithoutPassword } = updated;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { error: "프로필 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();

    // 관련 데이터 삭제
    await prisma.$transaction([
      prisma.bookmark.deleteMany({ where: { userId: user.id } }),
      prisma.review.deleteMany({ where: { userId: user.id } }),
      prisma.problemAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.oxAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.vocabAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.quizAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("Profile DELETE error:", error);
    return NextResponse.json(
      { error: "회원 탈퇴 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
