import { NextRequest, NextResponse } from "next/server";
import { chargeDueSubscriptions } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron (see vercel.json) that charges every subscription whose next
// billing date has arrived. Protected by CRON_SECRET — Vercel Cron sends it as
// `Authorization: Bearer <CRON_SECRET>`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await chargeDueSubscriptions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("billing cron error:", error);
    return NextResponse.json({ error: "정기결제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
