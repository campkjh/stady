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

    // 초대코드는 '처음 가입한 계정'에만 적용한다(이벤트 규칙: 친구가 처음 가입할 때).
    // 기존 계정이 초대 링크로 다시 로그인해 보상을 얻는 것을 막는다. 가입 직후 첫 앱 로드가
    // 늦어질 수 있어 창을 24시간으로 넉넉히 둔다.
    const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;
    const isRecentSignup = Date.now() - new Date(user.createdAt).getTime() < NEW_USER_WINDOW_MS;
    const referral = isRecentSignup
      ? await registerReferralInvite(user.id, inviteCode)
      : { applied: false, error: "초대코드는 처음 가입할 때만 적용할 수 있어요." };

    const response = NextResponse.json({ success: true, referralApplied: referral.applied, referralError: referral.error ?? null });
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
