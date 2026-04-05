import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;

  console.log("[Kakao Auth] clientId:", clientId ? `${clientId.slice(0, 6)}...` : "MISSING");
  console.log("[Kakao Auth] redirectUri:", redirectUri || "MISSING");

  if (!clientId || !redirectUri) {
    return NextResponse.json({
      error: "Kakao OAuth not configured",
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
    }, { status: 500 });
  }

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  return NextResponse.redirect(kakaoAuthUrl);
}
