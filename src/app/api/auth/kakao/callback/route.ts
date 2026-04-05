import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  console.log("[Kakao Callback] code:", code ? "present" : "missing", "error:", error);

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${error || "no_code"}`, request.url));
  }

  try {
    const clientId = process.env.KAKAO_REST_API_KEY!;
    const redirectUri = process.env.KAKAO_REDIRECT_URI!;

    console.log("[Kakao Callback] Using clientId:", clientId?.slice(0, 6), "redirectUri:", redirectUri);

    // 1. Exchange code for access token
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      client_secret: process.env.KAKAO_CLIENT_SECRET!,
    });

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    const tokenData = await tokenRes.json();
    console.log("[Kakao Callback] Token response status:", tokenRes.status, "has_token:", !!tokenData.access_token);

    if (!tokenData.access_token) {
      console.error("[Kakao Callback] Token error:", JSON.stringify(tokenData));
      return NextResponse.redirect(new URL("/login?error=token_failed", request.url));
    }

    // 2. Get user info from Kakao
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();

    const kakaoId = String(userData.id);
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname || `사용자${kakaoId.slice(-4)}`;
    const avatar = userData.properties?.profile_image || userData.kakao_account?.profile?.profile_image_url || null;
    const email = userData.kakao_account?.email || `kakao_${kakaoId}@stady.app`;

    console.log("[Kakao Callback] User:", { kakaoId, nickname, email: email.slice(0, 5) + "..." });

    // 3. Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    const existingUser = !!user;

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
    } else {
      // Update avatar if changed
      if (avatar && avatar !== user.avatar) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatar },
        });
      }
    }

    // 4. Set cookie and redirect
    const isNewUser = !existingUser;
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("userId", user.id, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (isNewUser) {
      response.cookies.set("isNewUser", "true", {
        path: "/",
        maxAge: 60 * 5, // 5 minutes
      });
    }

    return response;
  } catch (error) {
    console.error("[Kakao Callback] Error:", error);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
