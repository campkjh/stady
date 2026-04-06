import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.APPLE_CLIENT_ID;
  const redirectUri = process.env.APPLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({
      error: "Apple OAuth not configured",
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
    }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
  });

  const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;

  return NextResponse.redirect(appleAuthUrl);
}
