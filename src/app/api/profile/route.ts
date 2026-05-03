import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureUserStatusMessageColumn } from "@/lib/user-status";

interface StatusRow {
  statusMessage: string | null;
}

export async function GET() {
  try {
    const user = await requireUser();
    await ensureUserStatusMessageColumn();
    const statusRows = await prisma.$queryRawUnsafe<StatusRow[]>(
      `SELECT "statusMessage" FROM "User" WHERE "id" = $1 LIMIT 1`,
      user.id
    );
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        statusMessage: statusRows[0]?.statusMessage ?? null,
      },
    });
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
    await ensureUserStatusMessageColumn();
    const { nickname, avatar, statusMessage } = await request.json();

    const data: Record<string, unknown> = {};
    if (nickname !== undefined) data.nickname = nickname;
    if (avatar !== undefined) data.avatar = avatar;

    const updated = Object.keys(data).length > 0
      ? await prisma.user.update({
          where: { id: user.id },
          data,
        })
      : user;

    if (statusMessage !== undefined) {
      const normalizedStatus = String(statusMessage).trim().slice(0, 5);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "statusMessage" = $1 WHERE "id" = $2`,
        normalizedStatus || null,
        user.id
      );
    }

    const statusRows = await prisma.$queryRawUnsafe<StatusRow[]>(
      `SELECT "statusMessage" FROM "User" WHERE "id" = $1 LIMIT 1`,
      user.id
    );

    const { password: _, ...userWithoutPassword } = updated;

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        statusMessage: statusRows[0]?.statusMessage ?? null,
      },
    });
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
