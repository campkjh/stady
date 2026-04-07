import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded);
}

export async function POST(request: NextRequest) {
  try {
    const { identityToken, firstName, lastName } = await request.json();

    if (!identityToken) {
      return NextResponse.json({ error: "토큰이 없습니다." }, { status: 400 });
    }

    // id_token 디코딩
    const payload = decodeJwtPayload(identityToken);
    const appleId = payload.sub as string;
    const appleEmail = payload.email as string | undefined;

    const email = appleEmail || `apple_${appleId}@stady.app`;
    const nickname = ((lastName || "") + (firstName || "")).trim() || `사용자${appleId.slice(-4)}`;

    console.log("[Apple Native] User:", { appleId, email: email.slice(0, 5) + "...", nickname });

    // 유저 생성/조회
    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: `apple_${appleId}`,
          nickname,
          role: "user",
        },
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
    console.error("[Apple Native] Error:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
