import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// iOS 앱에서 카카오 로그인 후 호출하는 엔드포인트
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const kakaoId = searchParams.get("kakao_id");
    const nickname = searchParams.get("nickname");

    if (!email || !kakaoId) {
      return NextResponse.json({ error: "필수 파라미터가 없습니다." }, { status: 400 });
    }

    console.log("[Kakao App] Login:", { email: email.slice(0, 5) + "...", kakaoId, nickname });

    // 유저 생성/조회
    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: `kakao_${kakaoId}`,
          nickname: nickname || `사용자${kakaoId.slice(-4)}`,
          role: "user",
        },
      });
    }

    // 쿠키 설정 후 홈으로 리다이렉트
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("userId", user.id, {
      httpOnly: true,
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
    console.error("[Kakao App] Error:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
