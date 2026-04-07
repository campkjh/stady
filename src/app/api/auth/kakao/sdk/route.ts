import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: "토큰이 없습니다." }, { status: 400 });
    }

    // 카카오 사용자 정보 조회
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: "카카오 인증 실패" }, { status: 401 });
    }

    const userData = await userRes.json();

    const kakaoId = String(userData.id);
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname || `사용자${kakaoId.slice(-4)}`;
    const avatar = userData.properties?.profile_image || userData.kakao_account?.profile?.profile_image_url || null;
    const email = userData.kakao_account?.email || `kakao_${kakaoId}@stady.app`;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: `kakao_${kakaoId}`,
          nickname,
          avatar,
          role: "user",
        },
      });
    } else if (avatar && avatar !== user.avatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar },
      });
    }

    const response = NextResponse.json({ success: true, isNewUser });
    response.cookies.set("userId", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    if (isNewUser) {
      response.cookies.set("isNewUser", "true", {
        path: "/",
        maxAge: 60 * 5,
      });
    }

    return response;
  } catch (error) {
    console.error("[Kakao SDK] Error:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
