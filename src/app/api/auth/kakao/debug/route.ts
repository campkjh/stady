import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasClientId: !!process.env.KAKAO_REST_API_KEY,
    clientIdPrefix: process.env.KAKAO_REST_API_KEY?.slice(0, 8) || "MISSING",
    redirectUri: process.env.KAKAO_REDIRECT_URI || "MISSING",
    hasPublicKey: !!process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY,
  });
}
