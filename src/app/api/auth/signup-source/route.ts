import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerReferralInvite } from "@/lib/referrals";

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const { source, inviteCode } = await request.json();

    // The signup-source survey was removed; `source` is now optional and only
    // recorded when provided. The referral invite code is still applied.
    if (source && typeof source === "string") {
      await prisma.user.update({
        where: { id: user.id },
        data: { signupSource: source },
      });
    }

    const referral = await registerReferralInvite(user.id, inviteCode);

    const response = NextResponse.json({ success: true, referralApplied: referral.applied });
    response.cookies.set("isNewUser", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
