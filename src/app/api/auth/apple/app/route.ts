import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded);
}

// iOS 앱에서 애플 로그인 후 호출하는 엔드포인트
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const identityToken = searchParams.get("identity_token");
    const email = searchParams.get("email");
    const firstName = searchParams.get("first_name") || "";
    const lastName = searchParams.get("last_name") || "";

    if (!identityToken) {
      return NextResponse.json({ error: "토큰이 없습니다." }, { status: 400 });
    }

    // id_token 디코딩
    const payload = decodeJwtPayload(identityToken);
    const appleId = payload.sub as string;
    const appleEmail = (payload.email as string | undefined) || email;

    const userEmail = appleEmail || `apple_${appleId}@stady.app`;
    const nickname = ((lastName || "") + (firstName || "")).trim() || `사용자${appleId.slice(-4)}`;

    console.log("[Apple App] Login:", { email: userEmail.slice(0, 5) + "...", appleId, nickname });

    // 유저 생성/조회
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          password: `apple_${appleId}`,
          nickname,
          role: "user",
        },
      });
    }

    // 쿠키 설정 후 홈으로 리다이렉트
    const response = NextResponse.redirect(new URL("/", request.url));
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
    console.error("[Apple App] Error:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
