import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const idToken = formData.get("id_token") as string | null;
    const userStr = formData.get("user") as string | null;
    const error = formData.get("error") as string | null;

    if (error || !idToken) {
      console.error("[Apple Callback] Error:", error);
      return NextResponse.redirect(new URL(`/login?error=${error || "no_token"}`, request.url));
    }

    // Decode id_token to get user info
    const payload = decodeJwtPayload(idToken);
    const appleId = payload.sub as string;
    const appleEmail = payload.email as string | undefined;

    // Apple only sends name on first login
    let firstName = "";
    let lastName = "";
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        firstName = userData.name?.firstName || "";
        lastName = userData.name?.lastName || "";
      } catch {}
    }

    const email = appleEmail || `apple_${appleId}@stady.app`;
    const nickname = (lastName + firstName).trim() || `사용자${appleId.slice(-4)}`;

    console.log("[Apple Callback] User:", { appleId, email: email.slice(0, 5) + "...", nickname });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    const existingUser = !!user;

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

    // Set cookie and redirect
    const isNewUser = !existingUser;
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
    console.error("[Apple Callback] Error:", error);
    return NextResponse.redirect(new URL("/login?error=unknown", request.url));
  }
}
